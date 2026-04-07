import Foundation

#if canImport(ElasticApm)
import ElasticApm
#endif

@objc
public class EdotReactNativeAgent: NSObject {

  private static var preInitialized = false

  @objc
  public static func preInitialize(serverUrl: String, secretToken: String? = nil) {
    guard !preInitialized else { return }

    #if canImport(ElasticApm)
    var configBuilder = AgentConfigBuilder()
      .withExportUrl(URL(string: serverUrl)!)

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
