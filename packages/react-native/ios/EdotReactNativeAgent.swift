import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
#endif

@objc
public class EdotReactNativeAgent: NSObject {

  private static var preInitialized = false

  @objc
  public static func preInitialize(
    serverUrl: String,
    secretToken: String? = nil,
    serviceName: String? = nil,
    serviceVersion: String? = nil,
    deploymentEnvironment: String? = nil
  ) {
    guard !preInitialized else { return }
    guard let url = URL(string: serverUrl), !serverUrl.isEmpty else { return }

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
  }

  @objc
  public static var isPreInitialized: Bool {
    return preInitialized
  }

  /// Injects `service.name`, `service.version`, and `deployment.environment` into the OpenTelemetry
  /// `Resource` via the `OTEL_RESOURCE_ATTRIBUTES` environment variable. Must be called before
  /// `ElasticApmAgent.start(...)` because the agent captures the Resource at start time.
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
    setenv("OTEL_RESOURCE_ATTRIBUTES", pairs.joined(separator: ","), 1)
  }
}
