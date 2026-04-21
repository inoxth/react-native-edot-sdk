import Foundation
import React
import os.log

#if ELASTIC_APM_AVAILABLE
import ElasticApm
import OpenTelemetryApi
#endif

private let log = OSLog(subsystem: "com.edot.react-native", category: "SDK")

@objc(EdotReactNative)
class EdotReactNative: NSObject {

  private static let stateLock = NSLock()
  private static var isInitialized = false
  private static var debugEnabled = false

  private let spanLock = NSLock()
  #if ELASTIC_APM_AVAILABLE
  private var activeSpans: [String: any Span] = [:]
  #else
  private var activeSpans: [String: String] = [:]
  #endif

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
    return (g, s, u)
  }
  #endif

  // MARK: - Initialization

  @objc
  func initialize(_ config: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    EdotReactNative.stateLock.lock()
    if EdotReactNative.isInitialized {
      EdotReactNative.stateLock.unlock()
      debugLog("Already initialized, merging JS config")
      resolve(nil)
      return
    }
    EdotReactNative.debugEnabled = config["debug"] as? Bool ?? false
    EdotReactNative.stateLock.unlock()

    #if ELASTIC_APM_AVAILABLE
    let serverUrl = config["serverUrl"] as? String ?? ""

    guard let url = URL(string: serverUrl), !serverUrl.isEmpty else {
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

    var instrumentationConfig = InstrumentationConfiguration()
    if let v = config["enableCrashReporting"] as? Bool {
      instrumentationConfig.enableCrashReporting = v
    }
    if let v = config["enableURLSessionInstrumentation"] as? Bool {
      instrumentationConfig.enableURLSessionInstrumentation = v
    }
    if let v = config["enableViewControllerInstrumentation"] as? Bool {
      instrumentationConfig.enableViewControllerInstrumentation = v
    }
    if let v = config["enableAppMetricInstrumentation"] as? Bool {
      instrumentationConfig.enableAppMetricInstrumentation = v
    }
    if let v = config["enableSystemMetrics"] as? Bool {
      instrumentationConfig.enableSystemMetrics = v
    }
    if let v = config["enableLifecycleEvents"] as? Bool {
      instrumentationConfig.enableLifecycleEvents = v
    }

    if !EdotReactNativeAgent.isPreInitialized {
      EdotReactNativeAgent.applyResourceAttributes(
        serviceName: config["serviceName"] as? String,
        serviceVersion: config["serviceVersion"] as? String,
        deploymentEnvironment: config["deploymentEnvironment"] as? String
      )
      ElasticApmAgent.start(with: configBuilder.build(), instrumentationConfig)
    }

    EdotReactNative.stateLock.lock()
    EdotReactNative.isInitialized = true
    EdotReactNative.stateLock.unlock()
    debugLog("SDK initialized successfully")
    resolve(nil)
    #else
    debugLog("ElasticApm SDK not available — running as stub")
    EdotReactNative.stateLock.lock()
    EdotReactNative.isInitialized = true
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
    activeSpans[spanId] = span
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
    spanLock.unlock()

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
    spanLock.unlock()
    #endif
  }

  @objc
  func setSpanAttribute(_ spanId: String, key: String, value: String) {
    #if ELASTIC_APM_AVAILABLE
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()
    span?.setAttribute(key: key, value: .string(value))
    #endif
  }

  @objc
  func setSpanAttributeNumber(_ spanId: String, key: String, value: NSNumber) {
    #if ELASTIC_APM_AVAILABLE
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
    spanLock.lock()
    let span = activeSpans[spanId]
    spanLock.unlock()
    span?.setAttribute(key: key, value: .bool(value))
    #endif
  }

  @objc
  func recordSpanException(_ spanId: String, errorInfo: NSDictionary) {
    #if ELASTIC_APM_AVAILABLE
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
    let meter = OpenTelemetry.instance.meterProvider.get(name: "react-native-edot")

    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      if let k = key as? String, let v = val as? String {
        otelAttrs[k] = .string(v)
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
    let logger = OpenTelemetry.instance.loggerProvider
      .loggerBuilder(instrumentationScopeName: "react-native-edot")
      .build()

    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      if let k = key as? String, let v = val as? String {
        otelAttrs[k] = .string(v)
      }
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
    os_log("[EDOT] setTrackingConsent(%{public}@) called but not supported by native SDK", log: log, type: .info, consent)
  }

  // MARK: - Helpers

  private func debugLog(_ message: String) {
    if EdotReactNative.debugEnabled {
      os_log("[EDOT] %{public}@", log: log, type: .debug, message)
    }
  }

  #if ELASTIC_APM_AVAILABLE
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
