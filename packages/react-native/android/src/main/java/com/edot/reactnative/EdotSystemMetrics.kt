package com.edot.reactnative

import android.os.Debug
import android.os.Process
import android.os.SystemClock
import io.opentelemetry.api.OpenTelemetry
import io.opentelemetry.api.common.AttributeKey
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.metrics.ObservableDoubleGauge
import io.opentelemetry.api.metrics.ObservableLongGauge
import java.util.concurrent.atomic.AtomicLong

/// Re-implements iOS's `EdotSystemMetrics` for Android. Emits two observable
/// gauges, named and shaped to match iOS so cross-platform dashboards stay
/// consistent:
///
/// - `system.cpu.usage` (double gauge, attribute `state=app`) — percent of
///   wall-clock time the process spent on CPU since the previous sample.
///   Multi-threaded saturation can exceed 100% (e.g. 400% on a 4-core
///   device with all threads pinned), matching iOS's per-thread sum.
/// - `system.memory.usage` (long gauge, attribute `state=app`) — total PSS
///   (proportional set size) of the process in bytes.
///
/// `apm-agent-android` v1.5.0 does NOT auto-emit these gauges (no
/// equivalent of upstream's `CPUSampler` / `MemorySampler` is exposed).
/// Without this class, the metrics never reach APM Server on Android.
internal class EdotSystemMetrics private constructor(openTelemetry: OpenTelemetry) {

    private val cpuMeter = openTelemetry
        .meterBuilder(CPU_INSTRUMENTATION_NAME)
        .setInstrumentationVersion(INSTRUMENTATION_VERSION)
        .build()

    private val memoryMeter = openTelemetry
        .meterBuilder(MEMORY_INSTRUMENTATION_NAME)
        .setInstrumentationVersion(INSTRUMENTATION_VERSION)
        .build()

    // Process.getElapsedCpuTime() is a monotonic counter (cumulative CPU ms
    // across all threads). Converting it to "percent CPU since last sample"
    // requires the previous sample's value plus the wall clock at that
    // moment. Atomics keep the gauge callback thread-safe — the SDK metric
    // reader can invoke it from any thread.
    private val lastCpuMs = AtomicLong(Process.getElapsedCpuTime())
    private val lastWallMs = AtomicLong(SystemClock.elapsedRealtime())

    private val cpuGauge: ObservableDoubleGauge = cpuMeter
        .gaugeBuilder("system.cpu.usage")
        .buildWithCallback { measurement ->
            val now = SystemClock.elapsedRealtime()
            val cpu = Process.getElapsedCpuTime()
            val deltaWall = now - lastWallMs.getAndSet(now)
            val deltaCpu = cpu - lastCpuMs.getAndSet(cpu)
            if (deltaWall > 0 && deltaCpu >= 0) {
                val percent = (deltaCpu.toDouble() / deltaWall.toDouble()) * 100.0
                measurement.record(percent, STATE_APP)
            }
        }

    private val memoryGauge: ObservableLongGauge = memoryMeter
        .gaugeBuilder("system.memory.usage")
        .ofLongs()
        .buildWithCallback { measurement ->
            val info = Debug.MemoryInfo()
            Debug.getMemoryInfo(info)
            // totalPss is in KB; convert to bytes to match iOS's
            // `phys_footprint` units exactly.
            val bytes = info.totalPss.toLong() * 1024L
            if (bytes > 0) {
                measurement.record(bytes, STATE_APP)
            }
        }

    fun close() {
        cpuGauge.close()
        memoryGauge.close()
    }

    companion object {
        private const val CPU_INSTRUMENTATION_NAME = "CPU Sampler"
        private const val MEMORY_INSTRUMENTATION_NAME = "Memory Sampler"
        private const val INSTRUMENTATION_VERSION = "1.0.0"
        private val STATE_APP: Attributes = Attributes.of(AttributeKey.stringKey("state"), "app")

        @Volatile
        private var installed: EdotSystemMetrics? = null

        fun install(openTelemetry: OpenTelemetry) {
            if (installed != null) return
            synchronized(this) {
                if (installed != null) return
                installed = EdotSystemMetrics(openTelemetry)
                EdotReactNativeModuleImpl.debugLog(
                    "EdotSystemMetrics installed; emitting system.cpu.usage and system.memory.usage"
                )
            }
        }
    }
}
