import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
import GRPC
import NIO
import OpenTelemetryApi
import OpenTelemetryProtocolExporterCommon
import OpenTelemetryProtocolExporterGrpc
import OpenTelemetryProtocolExporterHttp
import OpenTelemetrySdk
import PersistenceExporter
import os.log

enum EdotMetricTransport {
  case http
  case grpc
}

/// Builds a resource-aware `MeterProvider` that we use in place of
/// `OpenTelemetry.instance.meterProvider` for our own metric emission paths
/// (`recordMetric`, `EdotAppMetrics`, `EdotSystemMetrics`).
///
/// apm-agent-ios v2.0.0's `OpenTelemetryInitializer` constructs the global
/// `MeterProvider` without `.setResource(...)`, so its metrics are exported
/// under `unknown_service:*`. We mirror its exporter setup here, attach the
/// same `Resource` it uses for traces and logs, and route our metric paths
/// through this provider until the upstream fix ships.
///
/// The catch-all `.*` View is load-bearing: opentelemetry-swift-core's
/// `ViewRegistry.findViews(...)` only iterates user-registered views and
/// ignores the per-`InstrumentType` defaults built in its init, so without
/// an explicit view no storage is registered for any observable instrument
/// and `collectAllMetrics()` returns empty.
///
/// `PeriodicMetricReaderBuilder` defaults to a 1s export interval. We pin
/// it to 60s here to match the OTel SDK spec recommended default and avoid
/// hammering the APM Server.
///
/// Exporter pipeline (outer → inner):
///   `PeriodicMetricReader → Logging? → Persistence → CentralConfigGate → HTTP|gRPC`
///
/// `Persistence` matches apm-agent-ios's default for traces and logs; failed
/// exports buffer to `Caches/elastic/` and replay on success. The central
/// config gate sits inside persistence so the kill-switch is honored at
/// flush time.
///
/// `CentralConfigGate` is a deliberate divergence from apm-agent-ios v2.0.0,
/// which does not honor `recording: Bool` on metrics. Keep it: removing it
/// re-introduces the bug where toggling "stop recording" in Kibana central
/// config silently fails to stop our metrics. Track upstream parity at
/// elastic/apm-agent-ios.
enum EdotMeterProviderFactory {
  static let exportIntervalSeconds: TimeInterval = 60

  static func build(
    serverUrl: URL,
    secretToken: String?,
    apiKey: String?,
    debug: Bool,
    transport: EdotMetricTransport,
    persistencePreset: String? = nil
  ) -> any MeterProvider {
    let config = OtlpConfiguration(
      timeout: OtlpConfiguration.DefaultTimeoutInterval,
      headers: headers(secretToken: secretToken, apiKey: apiKey)
    )
    let resource = AgentResource.get().merging(other: AgentEnvResource.get())

    let (baseExporter, logEndpoint) = makeBaseExporter(
      transport: transport,
      serverUrl: serverUrl,
      config: config
    )
    let gated: any MetricExporter = EdotCentralConfigMetricExporter(inner: baseExporter)
    let preset = resolvePreset(persistencePreset)
    let persisted = wrapWithPersistence(gated, preset: preset)
    let exporter: any MetricExporter = debug
      ? LoggingMetricExporter(inner: persisted, endpoint: logEndpoint)
      : persisted

    if debug {
      os_log(
        "[EDOT-METRICS] build endpoint=%{public}@ interval=%.0fs transport=%{public}@",
        log: log,
        type: .info,
        logEndpoint.absoluteString,
        exportIntervalSeconds,
        transport.label
      )
    }

    return MeterProviderSdk.builder()
      .setResource(resource: resource)
      .registerView(
        selector: InstrumentSelector.builder().setInstrument(name: ".*").build(),
        view: View.builder().build()
      )
      .registerMetricReader(
        reader: PeriodicMetricReaderBuilder(exporter: exporter)
          .setInterval(timeInterval: exportIntervalSeconds)
          .build()
      )
      .build()
  }

  private static let log = OSLog(subsystem: "co.elastic.edot", category: "metrics")

  /// Strong reference to the gRPC event loop group + channel created when
  /// `transport == .grpc`. Held for the process lifetime so the channel
  /// outlives the returned `MeterProvider`. Matches apm-agent-ios's
  /// internal NIO group lifetime — neither side exposes an explicit
  /// teardown; the OS reclaims threads and sockets at process exit.
  ///
  /// If a teardown path is ever needed (SDK reinit, App Clip cleanup),
  /// the correct shutdown sequence is:
  ///   `_ = try? channel.close().wait()`
  ///   `try? group.syncShutdownGracefully()`
  /// Order matters: closing the channel first lets in-flight RPCs drain.
  /// Shutting down the group while RPCs are alive trips a NIO precondition.
  private static var grpcResources: GrpcResources?

  private struct GrpcResources {
    let group: EventLoopGroup
    let channel: GRPCChannel
  }

  private static func makeBaseExporter(
    transport: EdotMetricTransport,
    serverUrl: URL,
    config: OtlpConfiguration
  ) -> (any MetricExporter, URL) {
    switch transport {
    case .http:
      let endpoint = metricsHttpEndpoint(from: serverUrl)
      return (OtlpHttpMetricExporter(endpoint: endpoint, config: config), endpoint)
    case .grpc:
      // Reassigning grpcResources would drop the previous EventLoopGroup
      // without `syncShutdownGracefully()`, which trips a NIO precondition
      // in debug and leaks threads in release. `EdotReactNative.initialize`
      // guards against double-build, so this should never fire.
      assert(grpcResources == nil, "EdotMeterProviderFactory.build called twice with .grpc; gRPC channel would leak")
      let group = MultiThreadedEventLoopGroup(numberOfThreads: 1)
      let channel = makeGrpcChannel(serverUrl: serverUrl, group: group)
      grpcResources = GrpcResources(group: group, channel: channel)
      return (OtlpMetricExporter(channel: channel, config: config), serverUrl)
    }
  }

  private static func makeGrpcChannel(serverUrl: URL, group: EventLoopGroup) -> GRPCChannel {
    let host = serverUrl.host ?? "localhost"
    let port = serverUrl.port ?? (serverUrl.scheme == "https" ? 443 : 80)
    let keepalive = ClientConnectionKeepalive(
      interval: .seconds(60),
      timeout: .seconds(20)
    )

    if serverUrl.scheme == "https" {
      return ClientConnection
        .usingPlatformAppropriateTLS(for: group)
        .withKeepalive(keepalive)
        .connect(host: host, port: port)
    }
    return ClientConnection
      .insecure(group: group)
      .withKeepalive(keepalive)
      .connect(host: host, port: port)
  }

  private static func resolvePreset(_ raw: String?) -> PersistencePerformancePreset {
    guard let raw else { return .default }
    switch raw {
    case "highVolume": return .instantDataDelivery
    default: return .default
    }
  }

  private static func wrapWithPersistence(
    _ inner: any MetricExporter,
    preset: PersistencePerformancePreset = .default
  ) -> any MetricExporter {
    guard let folder = persistenceFolder() else { return inner }
    do {
      return try PersistenceMetricExporterDecorator(
        metricExporter: inner,
        storageURL: folder,
        performancePreset: preset
      )
    } catch {
      return inner
    }
  }

  /// Mirrors apm-agent-ios's persistence root for traces and logs.
  /// `PersistenceExporter` segregates by signal type internally, so sharing
  /// the directory with apm-agent-ios's persisted traces and logs is safe.
  private static func persistenceFolder() -> URL? {
    do {
      let caches = try FileManager.default.url(
        for: .cachesDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      let dir = caches.appendingPathComponent("elastic")
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      return dir
    } catch {
      return nil
    }
  }

  private static func metricsHttpEndpoint(from serverUrl: URL) -> URL {
    let trimmed = serverUrl.absoluteString.hasSuffix("/")
      ? String(serverUrl.absoluteString.dropLast())
      : serverUrl.absoluteString
    return URL(string: "\(trimmed)/v1/metrics") ?? serverUrl
  }

  private static func headers(secretToken: String?, apiKey: String?) -> [(String, String)] {
    var headers: [(String, String)] = []
    if let token = secretToken, !token.isEmpty {
      headers.append(("Authorization", "Bearer \(token)"))
    } else if let key = apiKey, !key.isEmpty {
      headers.append(("Authorization", "ApiKey \(key)"))
    }
    return headers
  }
}

private extension EdotMetricTransport {
  var label: String {
    switch self {
    case .http: return "http"
    case .grpc: return "grpc"
    }
  }
}

private final class LoggingMetricExporter: MetricExporter {
  private let inner: any MetricExporter
  private let endpoint: URL
  private let log = OSLog(subsystem: "co.elastic.edot", category: "metrics")

  init(inner: any MetricExporter, endpoint: URL) {
    self.inner = inner
    self.endpoint = endpoint
  }

  func export(metrics: [MetricData]) -> ExportResult {
    os_log(
      "[EDOT-METRICS] export → %{public}d metrics → %{public}@",
      log: log,
      type: .info,
      metrics.count,
      endpoint.absoluteString
    )
    let result = inner.export(metrics: metrics)
    os_log(
      "[EDOT-METRICS] export ← %{public}@",
      log: log,
      type: .info,
      String(describing: result)
    )
    return result
  }

  func flush() -> ExportResult {
    let result = inner.flush()
    os_log("[EDOT-METRICS] flush ← %{public}@", log: log, type: .info, String(describing: result))
    return result
  }

  func shutdown() -> ExportResult {
    let result = inner.shutdown()
    os_log("[EDOT-METRICS] shutdown ← %{public}@", log: log, type: .info, String(describing: result))
    return result
  }

  func getAggregationTemporality(for instrument: InstrumentType) -> AggregationTemporality {
    inner.getAggregationTemporality(for: instrument)
  }

  func getDefaultAggregation(for instrument: InstrumentType) -> Aggregation {
    inner.getDefaultAggregation(for: instrument)
  }
}
#endif
