import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
#endif

/// Native-side entry point for starting the Elastic APM agent before the
/// React Native bridge has loaded.
///
/// Responsibilities:
/// - Provides `preInitialize(...)` for host apps that need the agent running
///   during early native startup (e.g. from `application(_:didFinishLaunchingWithOptions:)`),
///   so spans for pre-JS code paths (cold-start, native SDKs) aren't lost.
/// - Owns the `OTEL_RESOURCE_ATTRIBUTES` env var that carries `service.name`,
///   `service.version`, and `deployment.environment` into the SDK.
/// - Exposes `isPreInitialized` so `EdotReactNative.initialize` can detect a
///   prior native start and merge JS config without restarting the agent.
///
/// If the host app does not pre-initialize, `EdotReactNative.initialize`
/// starts the agent itself from the JS-supplied config — both paths are
/// supported, but only one starts the agent.
@objc
public class EdotReactNativeAgent: NSObject {

  private static let agentLock = NSLock()
  private static let envLock = NSLock()
  private static var preInitialized = false

  @objc
  public static func preInitialize(
    serverUrl: String,
    serviceName: String,
    serviceVersion: String,
    deploymentEnvironment: String,
    secretToken: String? = nil
  ) {
    if serverUrl.isEmpty {
      raiseInvalid("serverUrl must not be blank")
    }
    guard let url = URL(string: serverUrl) else {
      raiseInvalid("serverUrl is not a valid URL: \(serverUrl)")
    }
    requireResourceIdentity("serviceName", serviceName)
    requireResourceIdentity("serviceVersion", serviceVersion)
    requireResourceIdentity("deploymentEnvironment", deploymentEnvironment)

    agentLock.lock()
    guard !preInitialized else {
      agentLock.unlock()
      return
    }

    #if ELASTIC_APM_AVAILABLE
    applyResourceAttributes(
      serviceName: serviceName,
      serviceVersion: serviceVersion,
      deploymentEnvironment: deploymentEnvironment
    )

    var configBuilder = AgentConfigBuilder()
      .withExportUrl(url)

    if let token = secretToken {
      configBuilder = configBuilder.withSecretToken(token)
    }

    ElasticApmAgent.start(with: configBuilder.build())
    #endif

    preInitialized = true
    agentLock.unlock()
  }

  private static func requireResourceIdentity(_ name: String, _ value: String) {
    if value.isEmpty {
      raiseInvalid("\(name) must not be blank")
    }
    if value.contains(",") || value.contains("=") {
      raiseInvalid("\(name) must not contain ',' or '=' characters (got: \(value))")
    }
  }

  private static func raiseInvalid(_ reason: String) -> Never {
    NSException(
      name: .invalidArgumentException,
      reason: "[EDOT] \(reason)",
      userInfo: nil
    ).raise()
    fatalError("[EDOT] \(reason)")
  }

  @objc
  public static var isPreInitialized: Bool {
    agentLock.lock()
    let value = preInitialized
    agentLock.unlock()
    return value
  }

  static func applyResourceAttributes(
    serviceName: String?,
    serviceVersion: String?,
    deploymentEnvironment: String?
  ) {
    var pairs: [String] = []
    if let serviceName, !serviceName.isEmpty {
      pairs.append("service.name=\(serviceName)")
    }
    if let serviceVersion, !serviceVersion.isEmpty {
      pairs.append("service.version=\(serviceVersion)")
    }
    if let deploymentEnvironment, !deploymentEnvironment.isEmpty {
      pairs.append("deployment.environment=\(deploymentEnvironment)")
    }
    guard !pairs.isEmpty else { return }
    envLock.lock()
    setenv("OTEL_RESOURCE_ATTRIBUTES", pairs.joined(separator: ","), 1)
    envLock.unlock()
  }
}
