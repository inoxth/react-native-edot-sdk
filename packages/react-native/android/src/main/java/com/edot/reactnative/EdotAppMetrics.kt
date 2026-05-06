package com.edot.reactnative

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.view.Choreographer
import io.opentelemetry.api.OpenTelemetry
import java.util.concurrent.atomic.AtomicBoolean

/// Re-implements iOS's `EdotAppMetrics` for Android. Emits a single
/// `application.launch.time` histogram sample per process — the elapsed time
/// from process start (`Process.getStartUptimeMillis()`) to the first frame
/// drawn after the agent is ready.
///
/// `apm-agent-android` v1.5.0 does NOT auto-emit this metric (the upstream
/// release-note item referred to `opentelemetry-android`'s separate
/// `androidx.app.startup` instrumentation, which the EDOT distribution does
/// not pull in). Without this class, `application.launch.time` never reaches
/// APM Server on Android.
internal class EdotAppMetrics private constructor(
    private val application: Application,
    openTelemetry: OpenTelemetry,
) {
    private val recorded = AtomicBoolean(false)

    private val histogram = openTelemetry
        .getMeter(INSTRUMENTATION_NAME)
        .histogramBuilder(METRIC_NAME)
        .setUnit("s")
        .setDescription("Time from process start to first frame after agent ready")
        // OTel's default histogram bucket boundaries are tuned for HTTP request
        // durations in milliseconds, so a typical 1–5s cold start collapses into
        // the first bucket [0, 5] and APM Server reports the bucket midpoint
        // (2.5s) regardless of the true value. These boundaries match the
        // realistic range of mobile cold-start durations in seconds.
        .setExplicitBucketBoundariesAdvice(LAUNCH_TIME_BUCKETS)
        .build()

    private val callbacks = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
            scheduleRecord()
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityPaused(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {}
    }

    init {
        application.registerActivityLifecycleCallbacks(callbacks)
        // If an activity is already in the resumed state by the time the
        // agent installs us (typical for JS-init flows where the React root
        // mounts before `EdotReactNative.initialize`), `onActivityResumed`
        // won't fire again until a navigation happens. Post one frame
        // callback now so we still get a measurement on cold start.
        scheduleRecord()
    }

    private fun scheduleRecord() {
        if (recorded.get()) return
        Choreographer.getInstance().postFrameCallback {
            if (!recorded.compareAndSet(false, true)) return@postFrameCallback
            val elapsedMillis = SystemClock.uptimeMillis() - Process.getStartUptimeMillis()
            if (elapsedMillis > 0) {
                histogram.record(elapsedMillis / 1000.0)
                EdotReactNativeModuleImpl.debugLog(
                    "application.launch.time recorded ${elapsedMillis}ms"
                )
            }
            application.unregisterActivityLifecycleCallbacks(callbacks)
        }
    }

    companion object {
        private const val INSTRUMENTATION_NAME = "ApplicationMetrics"
        private const val METRIC_NAME = "application.launch.time"

        private val LAUNCH_TIME_BUCKETS: List<Double> = listOf(
            0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0,
            3.5, 4.0, 5.0, 7.5, 10.0, 15.0, 30.0,
        )

        @Volatile
        private var installed: EdotAppMetrics? = null

        fun install(application: Application, openTelemetry: OpenTelemetry) {
            if (installed != null) return
            val mainHandler = Handler(Looper.getMainLooper())
            mainHandler.post {
                if (installed == null) {
                    installed = EdotAppMetrics(application, openTelemetry)
                    EdotReactNativeModuleImpl.debugLog(
                        "EdotAppMetrics installed; bucket boundaries (s): $LAUNCH_TIME_BUCKETS"
                    )
                }
            }
        }
    }
}
