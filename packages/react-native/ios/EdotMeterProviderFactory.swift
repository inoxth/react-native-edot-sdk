import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
import OpenTelemetryApi
import OpenTelemetryProtocolExporterCommon
import OpenTelemetryProtocolExporterHttp
import OpenTelemetrySdk
import os.log

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
/// hammering the APM Server. apm-agent-ios uses the same 1s default but
/// masks it with `PersistenceMetricExporterDecorator`; we don't have that
/// decorator yet, so we slow the cadence directly.
///
/// The exporter is HTTP-only: cleanest path that avoids pulling in NIO/GRPC
/// transitively. The endpoint is `<serverUrl>/v1/metrics`. For an Elastic
/// Cloud APM endpoint that already accepts OTLP HTTP (`:443`), this works
/// regardless of whether apm-agent-ios is configured for gRPC for traces
/// and logs. Self-hosted setups with a gRPC-only port for metrics are not
/// supported by this workaround.
enum EdotMeterProviderFactory {
  static let exportIntervalSeconds: TimeInterval = 60

  static func build(
    serverUrl: URL,
    secretToken: String?,
    apiKey: String?,
    debug: Bool
  ) -> any MeterProvider {
    let endpoint = metricsEndpoint(from: serverUrl)
    let config = OtlpConfiguration(
      timeout: OtlpConfiguration.DefaultTimeoutInterval,
      headers: headers(secretToken: secretToken, apiKey: apiKey)
    )
    let httpExporter = OtlpHttpMetricExporter(endpoint: endpoint, config: config)
    let exporter: any MetricExporter = debug
      ? LoggingMetricExporter(inner: httpExporter, endpoint: endpoint)
      : httpExporter
    let resource = AgentResource.get().merging(other: AgentEnvResource.get())

    if debug {
      os_log(
        "[EDOT-METRICS] build endpoint=%{public}@ interval=%.0fs",
        log: log,
        type: .info,
        endpoint.absoluteString,
        exportIntervalSeconds
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

  private static func metricsEndpoint(from serverUrl: URL) -> URL {
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
