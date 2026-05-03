import Foundation

#if ELASTIC_APM_AVAILABLE
import ElasticApm
import OpenTelemetrySdk

/// Drops metric batches when apm-agent-ios's central-config kill-switch
/// (`CentralConfig().data.recording == false`) is active.
///
/// Returns `.success` on the off-state so any outer persistence layer
/// clears its buffer instead of retrying. apm-agent-ios's traces and logs
/// honor the same toggle through `SignalFilter`s configured at provider
/// build time; OpenTelemetry-swift's `MeterProvider` has no equivalent
/// hook, so we gate at the exporter boundary.
final class EdotCentralConfigMetricExporter: MetricExporter {
  private let inner: any MetricExporter
  private let centralConfig: CentralConfig

  init(inner: any MetricExporter, centralConfig: CentralConfig = CentralConfig()) {
    self.inner = inner
    self.centralConfig = centralConfig
  }

  func export(metrics: [MetricData]) -> ExportResult {
    guard centralConfig.data.recording else { return .success }
    return inner.export(metrics: metrics)
  }

  func flush() -> ExportResult {
    inner.flush()
  }

  func shutdown() -> ExportResult {
    inner.shutdown()
  }

  func getAggregationTemporality(for instrument: InstrumentType) -> AggregationTemporality {
    inner.getAggregationTemporality(for: instrument)
  }

  func getDefaultAggregation(for instrument: InstrumentType) -> Aggregation {
    inner.getDefaultAggregation(for: instrument)
  }
}
#endif
