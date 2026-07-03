import Foundation
import React
import os.log

#if ELASTIC_APM_AVAILABLE
import ElasticApm
import OpenTelemetryApi
import OpenTelemetrySdk
import URLSessionInstrumentation
#endif

private let log = OSLog(subsystem: "com.edot.react-native", category: "SDK")

enum TrackingConsent {
  case granted
  case notGranted
  case pending

  var allowsEmission: Bool {
    self == .granted
  }

  static func parse(_ raw: String?) -> TrackingConsent {
    switch raw {
    case "not_granted": return .notGranted
    case "pending": return .pending
    default: return .granted
    }
  }
}

/// React Native bridge module that exposes the EDOT SDK to JavaScript.
///
/// Responsibilities:
/// - Starts `ElasticApmAgent` from the JS-supplied config when the agent
///   has not been pre-initialized natively (see `EdotReactNativeAgent`).
/// - Installs a filtered `URLSessionInstrumentation` that complements the
///   JS fetch/XHR instrumentation (see `installURLSessionInstrumentation`).
/// - Owns the lifetime of spans started from JS (`startSpan` / `endSpan`),
///   indexed by id and capped at `activeSpansCap`.
/// - Gates all JS-side emission on the current tracking-consent state.
@objc(EdotReactNative)
class EdotReactNative: NSObject {

  private static let stateLock = NSLock()
  private static var isInitialized = false
  private static var isInitializing = false
  private static var trackingConsent: TrackingConsent = .granted

  /// Dedicated lock for the `debug` flag. Decoupled from `stateLock` so that
  /// `debugEnabledSnapshot()` can be called from any code path — including
  /// code that already holds `stateLock` (e.g., the os_log gate inside
  /// `EdotAppMetrics.init`, which is constructed under `stateLock`). Sharing
  /// `stateLock` would re-introduce a self-deadlock since `NSLock` is not
  /// reentrant.
  private static let debugLock = NSLock()
  private static var _debugEnabled = false

  private static func emissionAllowed() -> Bool {
    stateLock.lock()
    let allowed = trackingConsent.allowsEmission
    stateLock.unlock()
    return allowed
  }

  private static let activeSpansCap = 512

  #if ELASTIC_APM_AVAILABLE
  private static var urlSessionInstrumentation: URLSessionInstrumentation?
  #endif

  private let spanLock = NSLock()
  #if ELASTIC_APM_AVAILABLE
  private var activeSpans: [String: any Span] = [:]
  #else
  private var activeSpans: [String: String] = [:]
  #endif
  private var activeSpanQueue: [String] = []

  #if ELASTIC_APM_AVAILABLE
  private func tracer(named instrumentationName: String?) -> any Tracer {
    let resolved: String
    if let name = instrumentationName, !name.isEmpty {
      resolved = name
    } else {
      resolved = "react-native-edot"
    }
    return OpenTelemetry.instance.tracerProvider.get(instrumentationName: resolved, instrumentationVersion: nil)
  }
  #endif

  /// Logs (under `debug`) any JS config fields that the agent silently drops
  /// because the host app already pre-initialized via
  /// `EdotReactNativeAgent.preInitialize(...)` — they cannot be applied to an
  /// already-running agent.
  static func warnDroppedJsFieldsAfterPreInit(_ config: NSDictionary) {
    let reserved = ["apiKey", "sessionSamplingRate"]
    let present = reserved.filter { config[$0] != nil }
    guard !present.isEmpty, debugEnabledSnapshot() else { return }
    let joined = present.joined(separator: ", ")
    os_log(
      "[EDOT] Ignoring JS config field(s) after host pre-init: %{public}@. Pass them to EdotReactNativeAgent.preInitialize instead.",
      log: log,
      type: .info,
      joined
    )
  }

  // MARK: - Initialization

  @objc
  func initialize(_ config: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    EdotReactNative.stateLock.lock()
    if EdotReactNative.isInitialized || EdotReactNative.isInitializing {
      EdotReactNative.stateLock.unlock()
      debugLog("Already initialized or initializing, skipping")
      resolve(nil)
      return
    }
    EdotReactNative.isInitializing = true
    EdotReactNative.trackingConsent =
      TrackingConsent.parse(config["trackingConsent"] as? String)
    EdotReactNative.stateLock.unlock()

    EdotReactNative.setDebugEnabled(config["debug"] as? Bool ?? false)

    #if ELASTIC_APM_AVAILABLE
    let serverUrl = config["serverUrl"] as? String ?? ""

    guard let url = URL(string: serverUrl), !serverUrl.isEmpty else {
      EdotReactNative.stateLock.lock()
      EdotReactNative.isInitializing = false
      EdotReactNative.stateLock.unlock()
      reject("EDOT_INIT_ERROR", "Invalid serverUrl: \(serverUrl)", nil)
      return
    }

    var configBuilder = AgentConfigBuilder()
      .withServerUrl(url)

    if let secretToken = config["secretToken"] as? String {
      configBuilder = configBuilder.withSecretToken(secretToken)
    }

    if let apiKey = config["apiKey"] as? String {
      configBuilder = configBuilder.withApiKey(apiKey)
    }

    if let samplingRate = config["sessionSamplingRate"] as? Double {
      configBuilder = configBuilder.withSessionSampleRate(samplingRate)
    }

    if let exportProtocol = config["exportProtocol"] as? String {
      configBuilder = configBuilder.useConnectionType(exportProtocol == "http" ? .http : .grpc)
    }

    var instrumentationConfig = InstrumentationConfiguration()
    if let v = config["enableCrashReporting"] as? Bool {
      instrumentationConfig.enableCrashReporting = v
    }
    // Default OFF for React Native: JS-side navigation plugins
    // (`react-native-edot-navigation`, `-expo-router`, `-wix-navigation`) emit
    // route-named view spans. apm-agent-ios's UIKit `viewDidAppear:` swizzle
    // would otherwise emit a competing span — and on `react-native-screens`
    // that span is named `RNSScreen` (the wrapper VC class) because the title
    // isn't set when the swizzle fires. Opt-in via JS config if you want raw
    // UIVC spans instead of (or in addition to) the JS plugin spans.
    instrumentationConfig.enableViewControllerInstrumentation = false
    if let v = config["enableViewControllerInstrumentation"] as? Bool {
      instrumentationConfig.enableViewControllerInstrumentation = v
    }
    if let v = config["enableLifecycleEvents"] as? Bool {
      instrumentationConfig.enableLifecycleEvents = v
    }
    // We install our own filtered URLSessionInstrumentation below (see
    // installURLSessionInstrumentation); disable the agent's built-in one.
    instrumentationConfig.enableURLSessionInstrumentation = false

    // App/system metrics come from the agent's built-in AppMetrics / CPUSampler /
    // MemorySampler — `application.launch.time`, `system.cpu.usage`,
    // `system.memory.usage` (same names + `state=app` as Android). They default
    // on; let JS config toggle them so the flags behave the same on both platforms.
    if let v = config["enableAppMetricInstrumentation"] as? Bool {
      instrumentationConfig.enableAppMetricInstrumentation = v
    }
    if let v = config["enableSystemMetrics"] as? Bool {
      instrumentationConfig.enableSystemMetrics = v
    }

    if let spanNameRules = config["ignoreSpanNames"] as? [Any] {
      let predicates = Self.compileSpanNamePredicates(spanNameRules)
      if !predicates.isEmpty {
        configBuilder = configBuilder.addSpanFilter { span in
          !predicates.contains { $0(span.name) }
        }
      }
    }

    if let logPatternRules = config["ignoreLogPatterns"] as? [[String: Any]] {
      let predicates = Self.compileLogPredicates(logPatternRules)
      if !predicates.isEmpty {
        configBuilder = configBuilder.addLogFilter { record in
          !predicates.contains { $0(record) }
        }
      }
    }

    let agentDisabled = config["disableAgent"] as? Bool ?? false

    if !agentDisabled {
      if !EdotReactNativeAgent.isPreInitialized {
        EdotReactNativeAgent.applyResourceAttributes(
          serviceName: config["serviceName"] as? String,
          serviceVersion: config["serviceVersion"] as? String,
          deploymentEnvironment: config["deploymentEnvironment"] as? String
        )
        ElasticApmAgent.start(with: configBuilder.build(), instrumentationConfig)
      } else {
        EdotReactNative.warnDroppedJsFieldsAfterPreInit(config)
      }

      let urlSessionEnabled = config["enableURLSessionInstrumentation"] as? Bool ?? true
      if urlSessionEnabled {
        EdotReactNative.installURLSessionInstrumentation(serverUrl: serverUrl)
      }
    }

    EdotReactNative.stateLock.lock()
    EdotReactNative.isInitialized = true
    EdotReactNative.isInitializing = false
    EdotReactNative.stateLock.unlock()
    debugLog("SDK initialized successfully")
    resolve(nil)
    #else
    debugLog("ElasticApm SDK not available — running as stub")
    EdotReactNative.stateLock.lock()
    EdotReactNative.isInitialized = true
    EdotReactNative.isInitializing = false
    EdotReactNative.stateLock.unlock()
    resolve(nil)
    #endif
  }

  // MARK: - Session

  @objc
  func getCurrentSessionId(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if ELASTIC_APM_AVAILABLE
    let sessionId = SessionManager.instance.session(false)
    resolve(sessionId)
    #else
    resolve("")
    #endif
  }

  // MARK: - Error Reporting

  @objc
  func reportJsException(_ errorInfo: NSDictionary) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    let name = errorInfo["name"] as? String ?? "Unknown"
    let message = errorInfo["message"] as? String ?? ""
    let stack = errorInfo["stack"] as? String ?? ""
    let isFatal = errorInfo["isFatal"] as? Bool ?? false

    let eventName = isFatal ? "crash" : "exception"
    var attrs: [String: AttributeValue] = [
      "event.name": .string(eventName),
      "exception.type": .string(name),
      "exception.message": .string(message),
      "exception.stacktrace": .string(stack),
    ]
    if isFatal {
      attrs["event.domain"] = .string("device")
    }

    let logger = OpenTelemetry.instance.loggerProvider
      .loggerBuilder(instrumentationScopeName: "react-native-edot")
      .build()
    logger.logRecordBuilder()
      .setSeverity(.error)
      .setBody(.string(message))
      .setAttributes(attrs)
      .emit()
    #endif
  }

  // MARK: - Spans

  @objc
  func startSpan(_ name: String,
                 attributes: NSDictionary,
                 parentSpanId: NSString?,
                 instrumentationName: NSString?) -> String {
    return makeSpan(name: name,
                    attributes: attributes,
                    parentSpanId: parentSpanId,
                    instrumentationName: instrumentationName,
                    kind: .internal)
  }

  @objc
  func startClientSpan(_ name: String,
                       attributes: NSDictionary,
                       parentSpanId: NSString?,
                       instrumentationName: NSString?) -> String {
    return makeSpan(name: name,
                    attributes: attributes,
                    parentSpanId: parentSpanId,
                    instrumentationName: instrumentationName,
                    kind: .client)
  }

  private func makeSpan(name: String,
                        attributes: NSDictionary,
                        parentSpanId: NSString?,
                        instrumentationName: NSString?,
                        kind: SpanKind) -> String {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return "" }
    var builder = tracer(named: instrumentationName as String?)
      .spanBuilder(spanName: name)
      .setSpanKind(spanKind: kind)

    if let parentId = parentSpanId as? String {
      spanLock.lock()
      let parentSpan = activeSpans[parentId]
      spanLock.unlock()
      if let parent = parentSpan {
        builder = builder.setParent(parent)
      }
    }

    for (key, value) in attributes {
      guard let k = key as? String else { continue }
      if let attr = EdotReactNative.attributeValue(from: value) {
        builder = builder.setAttribute(key: k, value: attr)
      }
    }

    let span = builder.startSpan()

    let spanId = UUID().uuidString
    spanLock.lock()
    if activeSpans.count >= EdotReactNative.activeSpansCap,
       let oldest = activeSpanQueue.first {
      activeSpanQueue.removeFirst()
      activeSpans.removeValue(forKey: oldest)?.end()
    }
    activeSpans[spanId] = span
    activeSpanQueue.append(spanId)
    spanLock.unlock()

    return spanId
    #else
    return UUID().uuidString
    #endif
  }

  @objc
  func getTraceparent(_ spanHandle: String) -> String {
    #if ELASTIC_APM_AVAILABLE
    spanLock.lock()
    let span = activeSpans[spanHandle]
    spanLock.unlock()
    guard let span else { return "" }

    let ctx = span.context
    let traceId = ctx.traceId.hexString
    let spanId = ctx.spanId.hexString
    let flags = ctx.traceFlags.sampled ? "01" : "00"
    return "00-\(traceId)-\(spanId)-\(flags)"
    #else
    return ""
    #endif
  }

  @objc
  func endSpan(_ spanId: String, statusCode: Int) {
    #if ELASTIC_APM_AVAILABLE
    spanLock.lock()
    let span = activeSpans.removeValue(forKey: spanId)
    activeSpanQueue.removeAll { $0 == spanId }
    spanLock.unlock()

    guard EdotReactNative.emissionAllowed() else { return }

    if let otelSpan = span {
      // OTel StatusCode: 1=Ok, 2=Error
      if statusCode == 2 {
        otelSpan.status = .error(description: "")
      } else {
        otelSpan.status = .ok
      }
      otelSpan.end()
    }
    #else
    spanLock.lock()
    activeSpans.removeValue(forKey: spanId)
    activeSpanQueue.removeAll { $0 == spanId }
    spanLock.unlock()
    #endif
  }

  @objc
  func setSpanAttribute(_ spanId: String, key: String, value: String) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()
    span?.setAttribute(key: key, value: .string(value))
    #endif
  }

  @objc
  func setSpanAttributeNumber(_ spanId: String, key: String, value: NSNumber) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()
    if CFGetTypeID(value) == CFBooleanGetTypeID() {
      span?.setAttribute(key: key, value: .bool(value.boolValue))
    } else if CFNumberIsFloatType(value) {
      span?.setAttribute(key: key, value: .double(value.doubleValue))
    } else {
      span?.setAttribute(key: key, value: .int(value.intValue))
    }
    #endif
  }

  @objc
  func setSpanAttributeBoolean(_ spanId: String, key: String, value: Bool) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()
    span?.setAttribute(key: key, value: .bool(value))
    #endif
  }

  @objc
  func recordSpanException(_ spanId: String, errorInfo: NSDictionary) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()

    let message = errorInfo["message"] as? String ?? "Unknown error"
    span?.addEvent(name: "exception", attributes: [
      "exception.message": .string(message),
      "exception.type": .string(errorInfo["name"] as? String ?? "Error"),
      "exception.stacktrace": .string(errorInfo["stack"] as? String ?? ""),
    ])
    #endif
  }

  // MARK: - Metrics

  @objc
  func recordMetric(_ name: String,
                    value: Double,
                    attributes: NSDictionary,
                    metricType: String) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    // apm-agent-ios 1.2.1 registers only the legacy (resource-aware) MeterProvider,
    // not a stable one — so recordMetric uses the legacy meter API. Its labels are
    // string-only, so custom-metric attribute values are stringified here.
    let meter = OpenTelemetry.instance.meterProvider.get(
      instrumentationName: "react-native-edot",
      instrumentationVersion: nil
    )

    var labels: [String: String] = [:]
    for (key, val) in attributes {
      guard let k = key as? String else { continue }
      if let s = val as? String {
        labels[k] = s
      } else if let n = val as? NSNumber {
        labels[k] = n.stringValue
      } else {
        debugLog("recordMetric: skipping attribute '\(k)' — unsupported type")
      }
    }

    switch metricType {
    case "counter":
      let counter = meter.createIntCounter(name: name, monotonic: true)
      counter.add(value: Int(value), labels: labels)
    case "histogram":
      let measure = meter.createDoubleMeasure(name: name, absolute: true)
      measure.record(value: value, labels: labels)
    case "upDownCounter":
      let counter = meter.createIntCounter(name: name, monotonic: false)
      counter.add(value: Int(value), labels: labels)
    default:
      debugLog("Unknown metric type: \(metricType)")
    }
    #endif
  }

  // MARK: - Logs

  @objc
  func emitLog(_ severity: String,
               message: String,
               attributes: NSDictionary) {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return }
    let logger = OpenTelemetry.instance.loggerProvider
      .loggerBuilder(instrumentationScopeName: "react-native-edot")
      .build()

    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      guard let k = key as? String,
            let v = EdotReactNative.attributeValue(from: val) else { continue }
      otelAttrs[k] = v
    }

    logger.logRecordBuilder()
      .setSeverity(mapSeverity(severity))
      .setBody(.string(message))
      .setAttributes(otelAttrs)
      .emit()
    #endif
  }

  // MARK: - Consent

  @objc
  func setTrackingConsent(_ consent: String) {
    EdotReactNative.stateLock.lock()
    EdotReactNative.trackingConsent = TrackingConsent.parse(consent)
    EdotReactNative.stateLock.unlock()
  }

  // MARK: - Helpers

  static func debugEnabledSnapshot() -> Bool {
    debugLock.lock()
    defer { debugLock.unlock() }
    return _debugEnabled
  }

  private static func setDebugEnabled(_ value: Bool) {
    debugLock.lock()
    _debugEnabled = value
    debugLock.unlock()
  }

  private func debugLog(_ message: String) {
    if EdotReactNative.debugEnabledSnapshot() {
      os_log("[EDOT] %{public}@", log: log, type: .debug, message)
    }
  }

  #if ELASTIC_APM_AVAILABLE
  /// Header injected by the JS fetch/XHR instrumentation to mark requests it
  /// has already produced a span for. The native swizzle skips these to avoid
  /// emitting a duplicate span for the same HTTP call.
  private static let dedupHeader = "X-Edot-RN-Traced"

  /// Installs a custom `URLSessionInstrumentation` that replaces the bundled
  /// one in apm-agent-ios.
  ///
  /// We need our own instance because apm-agent-ios's
  /// `enableURLSessionInstrumentation` is on/off only — it does not expose the
  /// `shouldInstrument` / `nameSpan` callbacks we need to:
  ///
  /// 1. **Avoid self-tracing the agent's own backend traffic.** The agent talks
  ///    to the APM Server via `URLSession` for both OTLP export (`POST /v1/*`) and
  ///    central-config polling (`GET /config/v1/agents`, on a timer). An unfiltered
  ///    swizzle traces those requests — the export path even feeds back (spans →
  ///    exported → more spans). `isCollectorHostRequest` filters all of it by host.
  /// 2. **Avoid duplicate spans for JS-initiated requests.** React Native's
  ///    `fetch` and `XMLHttpRequest` go through `NSURLSession` on iOS, so an
  ///    unfiltered native swizzle would emit a second span for every request
  ///    our JS instrumentation already traces. The dedup header lets the JS
  ///    layer claim ownership of a request so the native side stays out of it.
  /// 3. **Match span naming with the JS layer** (`"METHOD host"`).
  ///
  /// Net effect: only non-JS URLSession traffic that isn't bound for the collector
  /// host (e.g. requests from third-party native SDKs) is traced natively.
  /// Everything originating from JS is traced exactly once, in JS.
  private static func installURLSessionInstrumentation(serverUrl: String) {
    guard urlSessionInstrumentation == nil else { return }

    let collectorHost = URLComponents(string: serverUrl)?.host

    let urlSessionConfig = URLSessionInstrumentationConfiguration(
      shouldInstrument: { request in
        if isCollectorHostRequest(request, collectorHost: collectorHost) {
          return false
        }
        if request.value(forHTTPHeaderField: dedupHeader) != nil {
          return false
        }
        return true
      },
      nameSpan: { request in
        guard let host = request.url?.host, let method = request.httpMethod else {
          return nil
        }
        return "\(method) \(host)"
      },
      spanCustomization: { _, builder in
        _ = builder.setAttribute(key: "http.client", value: AttributeValue.string("urlsession"))
      }
    )
    urlSessionInstrumentation = URLSessionInstrumentation(configuration: urlSessionConfig)
  }

  /// Whether `request` targets the collector host, i.e. it is one of the agent's
  /// own requests to its backend and must not be natively instrumented (see
  /// feedback-loop note above).
  ///
  /// Matches on **host alone** — not host + path. The agent talks to the collector
  /// for more than OTLP export: apm-agent-ios 1.2.1 also polls central config
  /// (`GET /config/v1/agents`) on a timer via `URLSession.shared`, and neither its
  /// `AgentConfigBuilder` nor `InstrumentationConfiguration` can disable that poll.
  /// A path filter (`/v1/`) caught exports but leaked the central-config GET,
  /// surfacing it as a spurious `GET <collectorHost>` transaction (DEV-785,
  /// regression of DEV-781). Matching by host is complete by construction: it
  /// covers export, central config, and any future agent→collector endpoint,
  /// and is robust to the agent stripping `:80`/`:443` from the export URL (port
  /// is never compared). Trade-off: native (non-JS) app requests to the same host
  /// are also excluded — negligible for a dedicated APM host, and JS-origin
  /// requests are still traced in JS.
  static func isCollectorHostRequest(_ request: URLRequest, collectorHost: String?) -> Bool {
    guard let collectorHost, let host = request.url?.host else {
      return false
    }
    return host.caseInsensitiveCompare(collectorHost) == .orderedSame
  }

  private static func compileSpanNamePredicates(_ rules: [Any]) -> [(String) -> Bool] {
    return rules.compactMap { rule in
      if let exact = rule as? String {
        return { name in name == exact }
      }
      if let patternObj = rule as? [String: Any],
         let source = patternObj["source"] as? String {
        let flags = patternObj["flags"] as? String ?? ""
        var options: NSRegularExpression.Options = []
        if flags.contains("i") { options.insert(.caseInsensitive) }
        if flags.contains("m") { options.insert(.anchorsMatchLines) }
        if flags.contains("s") { options.insert(.dotMatchesLineSeparators) }
        guard let regex = try? NSRegularExpression(pattern: source, options: options) else {
          return nil
        }
        return { name in
          let range = NSRange(name.startIndex..., in: name)
          return regex.firstMatch(in: name, range: range) != nil
        }
      }
      return nil
    }
  }

  private static func compileLogPredicates(
    _ rules: [[String: Any]]
  ) -> [(ReadableLogRecord) -> Bool] {
    return rules.compactMap { rule -> ((ReadableLogRecord) -> Bool)? in
      var namePredicate: ((String?) -> Bool)?
      var minSeverity: Severity?

      if let nameVal = rule["name"] as? String {
        namePredicate = { eventName in eventName == nameVal }
      } else if let patternObj = rule["name"] as? [String: Any],
                let source = patternObj["source"] as? String {
        let flags = patternObj["flags"] as? String ?? ""
        var options: NSRegularExpression.Options = []
        if flags.contains("i") { options.insert(.caseInsensitive) }
        if flags.contains("m") { options.insert(.anchorsMatchLines) }
        if flags.contains("s") { options.insert(.dotMatchesLineSeparators) }
        if let regex = try? NSRegularExpression(pattern: source, options: options) {
          namePredicate = { eventName in
            guard let n = eventName else { return false }
            let range = NSRange(n.startIndex..., in: n)
            return regex.firstMatch(in: n, range: range) != nil
          }
        }
      }

      if let severityStr = rule["minSeverity"] as? String {
        minSeverity = Self.parseSeverity(severityStr)
      }

      guard namePredicate != nil || minSeverity != nil else { return nil }

      return { record in
        var recordEventName: String?
        if case let .string(name)? = record.attributes["event.name"] {
          recordEventName = name
        }
        if let predicate = namePredicate, predicate(recordEventName) {
          return true
        }
        if let min = minSeverity, let recordSeverity = record.severity {
          return recordSeverity < min
        }
        return false
      }
    }
  }

  private static func parseSeverity(_ raw: String) -> Severity? {
    switch raw {
    case "trace": return .trace
    case "debug": return .debug
    case "info": return .info
    case "warn": return .warn
    case "error": return .error
    case "fatal": return .fatal
    default: return nil
    }
  }

  private static func attributeValue(from raw: Any) -> AttributeValue? {
    if let s = raw as? String {
      return .string(s)
    }
    if let n = raw as? NSNumber {
      if CFGetTypeID(n) == CFBooleanGetTypeID() {
        return .bool(n.boolValue)
      }
      if CFNumberIsFloatType(n) {
        return .double(n.doubleValue)
      }
      return .int(n.intValue)
    }
    return nil
  }

  private func mapSeverity(_ severity: String) -> Severity {
    switch severity {
    case "trace": return .trace
    case "debug": return .debug
    case "info": return .info
    case "warn": return .warn
    case "error": return .error
    case "fatal": return .fatal
    default: return .info
    }
  }
  #endif
}
