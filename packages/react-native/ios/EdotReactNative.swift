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

enum UserAttributesSpanScope {
  case all
  case idOnly
  case none

  static func parse(_ raw: String?) -> UserAttributesSpanScope {
    switch raw {
    case "all": return .all
    case "none": return .none
    default: return .idOnly
    }
  }
}

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
/// - Forwards user/session/global attributes and tracking-consent state
///   into every span emitted from JS.
@objc(EdotReactNative)
class EdotReactNative: NSObject {

  private static let stateLock = NSLock()
  private static var isInitialized = false
  private static var isInitializing = false
  private static var debugEnabled = false
  private static var userAttributesSpanScope: UserAttributesSpanScope = .idOnly
  private static var trackingConsent: TrackingConsent = .granted

  private static func emissionAllowed() -> Bool {
    stateLock.lock()
    let allowed = trackingConsent.allowsEmission
    stateLock.unlock()
    return allowed
  }

  private static let activeSpansCap = 512

  #if ELASTIC_APM_AVAILABLE
  private static var urlSessionInstrumentation: URLSessionInstrumentation?
  private static var meterProvider: (any MeterProvider)?
  private static var appMetrics: EdotAppMetrics?
  private static var systemMetrics: EdotSystemMetrics?
  private static var centralConfigObserver: NSObjectProtocol?
  private static var lastSeenCentralConfig: String?
  #endif

  private let spanLock = NSLock()
  #if ELASTIC_APM_AVAILABLE
  private var activeSpans: [String: any Span] = [:]
  #else
  private var activeSpans: [String: String] = [:]
  #endif
  private var activeSpanQueue: [String] = []

  #if ELASTIC_APM_AVAILABLE
  private static let attrLock = NSLock()
  private static var userAttributes: [String: AttributeValue] = [:]
  private static var sessionAttributes: [String: AttributeValue] = [:]
  private static var globalAttributes: [String: AttributeValue] = [:]

  private var tracer: any Tracer {
    OpenTelemetry.instance.tracerProvider.get(instrumentationName: "react-native-edot")
  }

  private static func readAttributes() -> (global: [String: AttributeValue],
                                            session: [String: AttributeValue],
                                            user: [String: AttributeValue]) {
    attrLock.lock()
    let g = globalAttributes
    let s = sessionAttributes
    let u = userAttributes
    attrLock.unlock()

    stateLock.lock()
    let scope = userAttributesSpanScope
    stateLock.unlock()

    return (g, s, filterUserAttributes(u, scope: scope))
  }

  private static func filterUserAttributes(_ all: [String: AttributeValue],
                                            scope: UserAttributesSpanScope)
    -> [String: AttributeValue] {
    switch scope {
    case .all:
      return all
    case .idOnly:
      if let id = all["enduser.id"] {
        return ["enduser.id": id]
      }
      return [:]
    case .none:
      return [:]
    }
  }
  #endif

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
    EdotReactNative.debugEnabled = config["debug"] as? Bool ?? false
    EdotReactNative.userAttributesSpanScope =
      UserAttributesSpanScope.parse(config["userAttributesIncludeInSpans"] as? String)
    EdotReactNative.trackingConsent =
      TrackingConsent.parse(config["trackingConsent"] as? String)
    EdotReactNative.stateLock.unlock()

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
      .withExportUrl(url)

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

    if config["useOpAMP"] as? Bool == true {
      configBuilder = configBuilder.useOpAMP()
    }

    if let managementUrlString = config["managementUrl"] as? String,
       let managementUrl = URL(string: managementUrlString) {
      configBuilder = configBuilder.withManagementUrl(managementUrl)
    }

    if let remoteManagement = config["remoteManagement"] as? Bool {
      configBuilder = configBuilder.withRemoteManagement(remoteManagement)
    }

    var instrumentationConfig = InstrumentationConfiguration()
    if let v = config["enableCrashReporting"] as? Bool {
      instrumentationConfig.enableCrashReporting = v
    }
    if let v = config["enableViewControllerInstrumentation"] as? Bool {
      instrumentationConfig.enableViewControllerInstrumentation = v
    }
    if let v = config["enableLifecycleEvents"] as? Bool {
      instrumentationConfig.enableLifecycleEvents = v
    }
    if let preset = config["persistencePreset"] as? String {
      instrumentationConfig.storageConfiguration = EdotReactNative.persistencePreset(from: preset)
    }
    // apm-agent-ios v2.0.0's OpenTelemetryInitializer builds the global
    // MeterProvider without setResource(...), so any metrics it emits land
    // under `unknown_service:*`. We disable its built-in metric sources and
    // replace them with EdotAppMetrics / EdotSystemMetrics, which use a
    // local resource-aware MeterProvider built below.
    instrumentationConfig.enableAppMetricInstrumentation = false
    instrumentationConfig.enableSystemMetrics = false
    let userAppMetricsEnabled = config["enableAppMetricInstrumentation"] as? Bool ?? true
    let userSystemMetricsEnabled = config["enableSystemMetrics"] as? Bool ?? true
    // Force-off here regardless of JS config — we replace it with a filtered
    // instance below. See `installURLSessionInstrumentation` for the reasoning.
    instrumentationConfig.enableURLSessionInstrumentation = false

    let agentDisabled = config["disableAgent"] as? Bool ?? false

    if !agentDisabled {
      if !EdotReactNativeAgent.isPreInitialized {
        EdotReactNativeAgent.applyResourceAttributes(
          serviceName: config["serviceName"] as? String,
          serviceVersion: config["serviceVersion"] as? String,
          deploymentEnvironment: config["deploymentEnvironment"] as? String
        )
        ElasticApmAgent.start(with: configBuilder.build(), instrumentationConfig)
      }

      EdotReactNative.installCentralConfigSampleRateObserver()

      let metricTransport: EdotMetricTransport =
        (config["exportProtocol"] as? String) == "http" ? .http : .grpc
      let meterProvider = EdotMeterProviderFactory.build(
        serverUrl: url,
        secretToken: config["secretToken"] as? String,
        apiKey: config["apiKey"] as? String,
        debug: EdotReactNative.debugEnabled,
        transport: metricTransport,
        persistencePreset: config["persistencePreset"] as? String
      )
      EdotReactNative.stateLock.lock()
      EdotReactNative.meterProvider = meterProvider
      if userAppMetricsEnabled {
        EdotReactNative.appMetrics = EdotAppMetrics(meterProvider: meterProvider)
      }
      if userSystemMetricsEnabled {
        EdotReactNative.systemMetrics = EdotSystemMetrics(meterProvider: meterProvider)
      }
      EdotReactNative.stateLock.unlock()

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

  @objc
  func setUser(_ userInfo: NSDictionary) {
    #if ELASTIC_APM_AVAILABLE
    EdotReactNative.attrLock.lock()
    if let userId = userInfo["id"] as? String {
      EdotReactNative.userAttributes["enduser.id"] = .string(userId)
    }
    if let email = userInfo["email"] as? String {
      EdotReactNative.userAttributes["enduser.email"] = .string(email)
    }
    if let name = userInfo["name"] as? String {
      EdotReactNative.userAttributes["enduser.name"] = .string(name)
    }
    EdotReactNative.attrLock.unlock()
    #endif
  }

  @objc
  func clearUser() {
    #if ELASTIC_APM_AVAILABLE
    EdotReactNative.attrLock.lock()
    EdotReactNative.userAttributes.removeAll()
    EdotReactNative.attrLock.unlock()
    #endif
  }

  // MARK: - Attributes

  @objc
  func setSessionAttribute(_ key: String, value: String) {
    #if ELASTIC_APM_AVAILABLE
    EdotReactNative.attrLock.lock()
    EdotReactNative.sessionAttributes[key] = .string(value)
    EdotReactNative.attrLock.unlock()
    #endif
  }

  @objc
  func setGlobalAttribute(_ key: String, value: String) {
    #if ELASTIC_APM_AVAILABLE
    EdotReactNative.attrLock.lock()
    EdotReactNative.globalAttributes[key] = .string(value)
    EdotReactNative.attrLock.unlock()
    #endif
  }

  @objc
  func removeGlobalAttribute(_ key: String) {
    #if ELASTIC_APM_AVAILABLE
    EdotReactNative.attrLock.lock()
    EdotReactNative.globalAttributes.removeValue(forKey: key)
    EdotReactNative.attrLock.unlock()
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

    let span = tracer.spanBuilder(spanName: "js_error: \(name)").startSpan()
    span.setAttribute(key: "exception.type", value: .string(name))
    span.setAttribute(key: "exception.message", value: .string(message))
    span.setAttribute(key: "exception.stacktrace", value: .string(stack))
    span.setAttribute(key: "error.is_fatal", value: .bool(isFatal))
    span.status = .error(description: message)
    span.end()
    #endif
  }

  // MARK: - Spans

  @objc
  func startSpan(_ name: String,
                 attributes: NSDictionary,
                 parentSpanId: NSString?) -> String {
    #if ELASTIC_APM_AVAILABLE
    guard EdotReactNative.emissionAllowed() else { return "" }
    var builder = tracer.spanBuilder(spanName: name)

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

    let (global, session, user) = EdotReactNative.readAttributes()
    for (key, value) in global {
      builder = builder.setAttribute(key: key, value: value)
    }
    for (key, value) in session {
      builder = builder.setAttribute(key: key, value: value)
    }
    for (key, value) in user {
      builder = builder.setAttribute(key: key, value: value)
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
    EdotReactNative.stateLock.lock()
    let provider = EdotReactNative.meterProvider
    EdotReactNative.stateLock.unlock()
    guard let provider else {
      debugLog("recordMetric: meterProvider not initialized — skipping")
      return
    }
    let meter = provider.get(name: "react-native-edot")

    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      guard let k = key as? String else { continue }
      if let attr = EdotReactNative.attributeValue(from: val) {
        otelAttrs[k] = attr
      } else {
        debugLog("recordMetric: skipping attribute '\(k)' — unsupported type")
      }
    }

    switch metricType {
    case "counter":
      var counter = meter.counterBuilder(name: name).build()
      counter.add(value: Int(value), attributes: otelAttrs)
    case "histogram":
      var histogram = meter.histogramBuilder(name: name).build()
      histogram.record(value: value, attributes: otelAttrs)
    case "upDownCounter":
      var counter = meter.upDownCounterBuilder(name: name).build()
      counter.add(value: Int(value), attributes: otelAttrs)
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

  private static func debugEnabledSnapshot() -> Bool {
    stateLock.lock()
    let v = debugEnabled
    stateLock.unlock()
    return v
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
  /// 1. **Avoid an OTLP feedback loop.** The agent's exporter POSTs to the APM
  ///    Server via `URLSession`. An unfiltered swizzle traces those exporter
  ///    requests, which produces more spans, which get exported, and so on.
  /// 2. **Avoid duplicate spans for JS-initiated requests.** React Native's
  ///    `fetch` and `XMLHttpRequest` go through `NSURLSession` on iOS, so an
  ///    unfiltered native swizzle would emit a second span for every request
  ///    our JS instrumentation already traces. The dedup header lets the JS
  ///    layer claim ownership of a request so the native side stays out of it.
  /// 3. **Match span naming with the JS layer** (`"METHOD host"`).
  ///
  /// Net effect: only non-JS, non-exporter URLSession traffic (e.g. requests
  /// from third-party native SDKs) is traced natively. Everything originating
  /// from JS is traced exactly once, in JS.
  private static func installURLSessionInstrumentation(serverUrl: String) {
    guard urlSessionInstrumentation == nil else { return }

    let urlSessionConfig = URLSessionInstrumentationConfiguration(
      shouldInstrument: { request in
        if let url = request.url?.absoluteString, url.hasPrefix(serverUrl) {
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
      }
    )
    urlSessionInstrumentation = URLSessionInstrumentation(configuration: urlSessionConfig)
  }

  private static func persistencePreset(from raw: String) -> PersistencePerformancePreset {
    switch raw {
    case "highVolume": return .instantDataDelivery
    default: return .default
    }
  }

  /// Observes UserDefaults for changes to the apm-agent-ios central-config key.
  ///
  /// When `CentralConfigFetcher` writes a new config payload, UserDefaults posts
  /// `.didChangeNotification`. We detect the change and re-post
  /// `.elasticSessionManagerDidRefreshSession` so that `SessionSampler` re-runs
  /// its `sampleRateResolver` closure — which reads `CentralConfig().data.sampleRate`
  /// — and updates its cached `shouldSample` flag. This makes central-config
  /// `sampleRate` changes apply at the next polling boundary rather than only at
  /// the next session refresh.
  private static func installCentralConfigSampleRateObserver() {
    guard centralConfigObserver == nil else { return }
    let key = "elastic.central.configuration"
    lastSeenCentralConfig = UserDefaults.standard.object(forKey: key) as? String
    centralConfigObserver = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification,
      object: UserDefaults.standard,
      queue: nil
    ) { _ in
      let current = UserDefaults.standard.object(forKey: key) as? String
      stateLock.lock()
      let previous = lastSeenCentralConfig
      if current != previous {
        lastSeenCentralConfig = current
      }
      stateLock.unlock()
      guard current != previous else { return }
      NotificationCenter.default.post(
        name: .elasticSessionManagerDidRefreshSession,
        object: nil
      )
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
