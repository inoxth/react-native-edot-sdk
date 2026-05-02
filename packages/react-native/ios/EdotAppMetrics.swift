import Foundation

#if ELASTIC_APM_AVAILABLE
import OpenTelemetryApi

#if os(iOS)
import MetricKit

/// MetricKit subscriber that re-implements apm-agent-ios v2.0.0's
/// `AppMetrics` against our resource-aware `MeterProvider`.
///
/// Mirrors upstream's actively-recorded metric only: the
/// `application.launch.time` histogram derived from
/// `MXAppLaunchMetric.histogrammedTimeToFirstDraw`. All other `recordX`
/// methods in upstream are commented out, so we don't replicate them.
final class EdotAppMetrics: NSObject, MXMetricManagerSubscriber {
  private static let instrumentationName = "ApplicationMetrics"
  private static let instrumentationVersion = "0.0.3"
  private static let appLaunchTimeMetric = "application.launch.time"

  private let meter: any Meter

  init(meterProvider: any MeterProvider) {
    self.meter = meterProvider
      .meterBuilder(name: Self.instrumentationName)
      .setInstrumentationVersion(instrumentationVersion: Self.instrumentationVersion)
      .build()
    super.init()
    MXMetricManager.shared.add(self)
  }

  deinit {
    MXMetricManager.shared.remove(self)
  }

  func didReceive(_ payloads: [MXMetricPayload]) {
    for payload in payloads {
      recordTimeToFirstDraw(metric: payload)
    }
  }

  @available(iOS 14.0, *)
  func didReceive(_ payloads: [MXDiagnosticPayload]) {}

  private func recordTimeToFirstDraw(metric: MXMetricPayload) {
    guard
      let enumerator = metric.applicationLaunchMetrics?
        .histogrammedTimeToFirstDraw
        .bucketEnumerator,
      let buckets = enumerator.allObjects as? [MXHistogramBucket]
    else { return }

    var bounds: [Double] = []
    var counts: [Int] = []
    var values: [Double] = []
    for bucket in buckets {
      bounds.append(bucket.bucketStart.value)
      bounds.append(bucket.bucketEnd.value)
      counts.append(0)
      counts.append(bucket.bucketCount)
      values.append(bucket.bucketStart.value + bucket.bucketEnd.value / 2)
    }
    counts.append(0)

    var histogram = meter
      .histogramBuilder(name: Self.appLaunchTimeMetric)
      .setExplicitBucketBoundariesAdvice(bounds)
      .build()

    for (index, count) in counts.enumerated() where index < values.count {
      for _ in 0 ..< count {
        histogram.record(value: values[index])
      }
    }
  }
}
#else
final class EdotAppMetrics {
  init(meterProvider: any MeterProvider) {}
}
#endif
#endif
