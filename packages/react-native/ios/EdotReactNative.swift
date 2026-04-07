import Foundation
import React

#if canImport(ElasticApm)
import ElasticApm
private let elasticAvailable = true
#else
private let elasticAvailable = false
#endif

@objc(EdotReactNative)
class EdotReactNative: NSObject {

  private static var isInitialized = false
  private static var debugEnabled = false

  private let spanLock = NSLock()
  private var activeSpans: [String: Any] = [:]

  // MARK: - Initialization

  @objc
  func initialize(_ config: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    if EdotReactNative.isInitialized {
      debugLog("Already initialized, merging JS config")
      resolve(nil)
      return
    }

    EdotReactNative.debugEnabled = config["debug"] as? Bool ?? false

    #if canImport(ElasticApm)
    do {
      let serverUrl = config["serverUrl"] as? String ?? ""
      let serviceName = config["serviceName"] as? String ?? ""
      let serviceVersion = config["serviceVersion"] as? String ?? ""
      let environment = config["deploymentEnvironment"] as? String ?? ""

      var configBuilder = AgentConfigBuilder()
        .withExportUrl(URL(string: serverUrl)!)
        .withServiceName(serviceName)
        .withServiceVersion(serviceVersion)
        .withEnvironment(environment)

      if let secretToken = config["secretToken"] as? String {
        configBuilder = configBuilder.withSecretToken(secretToken)
      }

      if let apiKey = config["apiKey"] as? String {
        configBuilder = configBuilder.withApiKey(apiKey)
      }

      if let samplingRate = config["sessionSamplingRate"] as? Double {
        configBuilder = configBuilder.withSampleRate(samplingRate)
      }

      if let enableMetricKit = config["enableMetricKit"] as? Bool, enableMetricKit {
        configBuilder = configBuilder.withMetricKit(true)
      }

      ElasticApmAgent.start(with: configBuilder.build())

      EdotReactNative.isInitialized = true
      debugLog("SDK initialized successfully")
      resolve(nil)
    } catch {
      reject("EDOT_INIT_ERROR", "Failed to initialize EDOT: \(error.localizedDescription)", error)
    }
    #else
    debugLog("ElasticApm SDK not available — running as stub")
    EdotReactNative.isInitialized = true
    resolve(nil)
    #endif
  }

  // MARK: - Session

  @objc
  func getCurrentSessionId(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(ElasticApm)
    let sessionId = ElasticApmAgent.shared?.getSessionId() ?? ""
    resolve(sessionId)
    #else
    resolve("")
    #endif
  }

  @objc
  func setUser(_ userInfo: NSDictionary) {
    #if canImport(ElasticApm)
    guard let userId = userInfo["id"] as? String else { return }
    let email = userInfo["email"] as? String
    let name = userInfo["name"] as? String
    ElasticApmAgent.shared?.setUser(id: userId, email: email, name: name)
    #endif
  }

  @objc
  func clearUser() {
    #if canImport(ElasticApm)
    ElasticApmAgent.shared?.setUser(id: nil, email: nil, name: nil)
    #endif
  }

  // MARK: - Attributes

  @objc
  func setSessionAttribute(_ key: String, value: String) {
    #if canImport(ElasticApm)
    ElasticApmAgent.shared?.setAttribute(key: key, value: .string(value))
    #endif
  }

  @objc
  func setGlobalAttribute(_ key: String, value: String) {
    #if canImport(ElasticApm)
    ElasticApmAgent.shared?.setGlobalAttribute(key: key, value: .string(value))
    #endif
  }

  @objc
  func removeGlobalAttribute(_ key: String) {
    #if canImport(ElasticApm)
    ElasticApmAgent.shared?.removeGlobalAttribute(key: key)
    #endif
  }

  // MARK: - Error Reporting

  @objc
  func reportJsException(_ errorInfo: NSDictionary) {
    #if canImport(ElasticApm)
    let name = errorInfo["name"] as? String ?? "Unknown"
    let message = errorInfo["message"] as? String ?? ""
    let stack = errorInfo["stack"] as? String ?? ""
    let isFatal = errorInfo["isFatal"] as? Bool ?? false

    ElasticApmAgent.shared?.reportError(
      message: "\(name): \(message)",
      attributes: [
        "exception.type": .string(name),
        "exception.message": .string(message),
        "exception.stacktrace": .string(stack),
        "error.is_fatal": .bool(isFatal),
      ]
    )
    #endif
  }

  // MARK: - Spans

  @objc
  func startSpan(_ name: String,
                 attributes: NSDictionary,
                 parentSpanId: NSString?) -> String {
    #if canImport(ElasticApm)
    let tracer = ElasticApmAgent.shared?.getTracer(name: "edot-react-native")
    let spanBuilder = tracer?.spanBuilder(spanName: name)

    if let parentId = parentSpanId as String? {
      spanLock.lock()
      let parentSpan = activeSpans[parentId] as? Span
      spanLock.unlock()
      if let parent = parentSpan {
        spanBuilder?.setParent(parent)
      }
    }

    for (key, value) in attributes {
      if let k = key as? String, let v = value as? String {
        spanBuilder?.setAttribute(key: k, value: .string(v))
      }
    }

    guard let span = spanBuilder?.startSpan() else {
      return ""
    }

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
    #if canImport(ElasticApm)
    spanLock.lock()
    let span = activeSpans.removeValue(forKey: spanId) as? Span
    spanLock.unlock()

    if statusCode == 2 {
      span?.setStatus(.error)
    } else {
      span?.setStatus(.ok)
    }
    span?.end()
    #else
    spanLock.lock()
    activeSpans.removeValue(forKey: spanId)
    spanLock.unlock()
    #endif
  }

  @objc
  func setSpanAttribute(_ spanId: String, key: String, value: String) {
    #if canImport(ElasticApm)
    spanLock.lock()
    let span = activeSpans[spanId] as? Span
    spanLock.unlock()
    span?.setAttribute(key: key, value: .string(value))
    #endif
  }

  @objc
  func recordSpanException(_ spanId: String, errorInfo: NSDictionary) {
    #if canImport(ElasticApm)
    spanLock.lock()
    let span = activeSpans[spanId] as? Span
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
    #if canImport(ElasticApm)
    let meter = ElasticApmAgent.shared?.getMeter(name: "edot-react-native")

    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      if let k = key as? String, let v = val as? String {
        otelAttrs[k] = .string(v)
      }
    }

    switch metricType {
    case "counter":
      let counter = meter?.counterBuilder(name: name).build()
      counter?.add(value: Int(value), attributes: otelAttrs)
    case "histogram":
      let histogram = meter?.histogramBuilder(name: name).build()
      histogram?.record(value: value, attributes: otelAttrs)
    case "upDownCounter":
      let counter = meter?.upDownCounterBuilder(name: name).build()
      counter?.add(value: Int(value), attributes: otelAttrs)
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
    #if canImport(ElasticApm)
    var otelAttrs: [String: AttributeValue] = [:]
    for (key, val) in attributes {
      if let k = key as? String, let v = val as? String {
        otelAttrs[k] = .string(v)
      }
    }

    ElasticApmAgent.shared?.log(
      severity: mapSeverity(severity),
      message: message,
      attributes: otelAttrs
    )
    #endif
  }

  // MARK: - Consent

  @objc
  func setTrackingConsent(_ consent: String) {
    #if canImport(ElasticApm)
    switch consent {
    case "granted":
      ElasticApmAgent.shared?.setTrackingConsent(.granted)
    case "not_granted":
      ElasticApmAgent.shared?.setTrackingConsent(.notGranted)
    case "pending":
      ElasticApmAgent.shared?.setTrackingConsent(.pending)
    default:
      debugLog("Unknown consent state: \(consent)")
    }
    #endif
  }

  // MARK: - Helpers

  private func debugLog(_ message: String) {
    if EdotReactNative.debugEnabled {
      print("[EDOT] \(message)")
    }
  }

  #if canImport(ElasticApm)
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
