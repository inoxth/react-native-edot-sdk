import Foundation
import os.log

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
///
/// **MetricKit delivery cadence:** Apple delivers `MXMetricPayload`
/// approximately once every 24 hours per device, typically when the
/// device is plugged in and on Wi-Fi. In-Xcode debug builds may not
/// receive payloads at all. To verify in development, use Xcode's
/// `Debug → Simulate Metric Payload` while the simulator is running.
final class EdotAppMetrics: NSObject, MXMetricManagerSubscriber {
  private static let instrumentationName = "ApplicationMetrics"
  private static let instrumentationVersion = "0.0.3"
  private static let appLaunchTimeMetric = "application.launch.time"
  private static let log = OSLog(subsystem: "co.elastic.edot", category: "metrics")

  private let meter: any Meter
  private var histogram: (any DoubleHistogram)?

  init(meterProvider: any MeterProvider) {
    self.meter = meterProvider
      .meterBuilder(name: Self.instrumentationName)
      .setInstrumentationVersion(instrumentationVersion: Self.instrumentationVersion)
      .build()
    super.init()
    MXMetricManager.shared.add(self)
    if EdotReactNative.debugEnabledSnapshot() {
      os_log(
        "[EDOT] EdotAppMetrics subscribed to MXMetricManager (delivery cadence ≈ 24h)",
        log: Self.log,
        type: .info
      )
    }
  }

  deinit {
    MXMetricManager.shared.remove(self)
  }

  func didReceive(_ payloads: [MXMetricPayload]) {
    if EdotReactNative.debugEnabledSnapshot() {
      os_log(
        "[EDOT] didReceive %{public}d MXMetricPayload(s)",
        log: Self.log,
        type: .info,
        payloads.count
      )
    }
    for payload in payloads {
      recordTimeToFirstDraw(metric: payload)
    }
  }

  @available(iOS 14.0, *)
  func didReceive(_ payloads: [MXDiagnosticPayload]) {}

  private func recordTimeToFirstDraw(metric: MXMetricPayload) {
    guard let appLaunchMetrics = metric.applicationLaunchMetrics else {
      if EdotReactNative.debugEnabledSnapshot() {
        os_log(
          "[EDOT] payload had no applicationLaunchMetrics — skipping",
          log: Self.log,
          type: .info
        )
      }
      return
    }

    guard let buckets = appLaunchMetrics
      .histogrammedTimeToFirstDraw
      .bucketEnumerator
      .allObjects as? [MXHistogramBucket<UnitDuration>]
    else {
      if EdotReactNative.debugEnabledSnapshot() {
        os_log(
          "[EDOT] histogrammedTimeToFirstDraw bucketEnumerator returned no buckets",
          log: Self.log,
          type: .info
        )
      }
      return
    }

    if buckets.isEmpty {
      if EdotReactNative.debugEnabledSnapshot() {
        os_log(
          "[EDOT] histogrammedTimeToFirstDraw is empty (no launches captured)",
          log: Self.log,
          type: .info
        )
      }
      return
    }

    if histogram == nil {
      histogram = meter
        .histogramBuilder(name: Self.appLaunchTimeMetric)
        .setExplicitBucketBoundariesAdvice(boundsFromBuckets(buckets))
        .build()
    }
    guard var instrument = histogram else { return }

    var totalRecorded = 0
    for bucket in buckets {
      let midpoint = (bucket.bucketStart.value + bucket.bucketEnd.value) / 2
      for _ in 0..<bucket.bucketCount {
        instrument.record(value: midpoint)
      }
      totalRecorded += bucket.bucketCount
    }
    histogram = instrument

    if EdotReactNative.debugEnabledSnapshot() {
      os_log(
        "[EDOT] application.launch.time recorded %{public}d sample(s) across %{public}d bucket(s)",
        log: Self.log,
        type: .info,
        totalRecorded,
        buckets.count
      )
    }
  }

  /// Inner bucket boundaries for OTel histogram advice — the upper bound of
  /// every bucket except the last. With N source buckets, this yields N-1
  /// boundaries and N OTel histogram buckets that mirror MetricKit's shape.
  private func boundsFromBuckets(_ buckets: [MXHistogramBucket<UnitDuration>]) -> [Double] {
    guard buckets.count > 1 else { return [] }
    return buckets.dropLast().map { $0.bucketEnd.value }
  }
}
#else
final class EdotAppMetrics {
  init(meterProvider: any MeterProvider) {}
}
#endif
#endif
