import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
#endif

@objc
public class EdotReactNativeAgent: NSObject {

  private static var preInitialized = false

  @objc
  public static func preInitialize(serverUrl: String, secretToken: String? = nil) {
    guard !preInitialized else { return }
    guard let url = URL(string: serverUrl), !serverUrl.isEmpty else { return }

    #if ELASTIC_APM_AVAILABLE
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
}
