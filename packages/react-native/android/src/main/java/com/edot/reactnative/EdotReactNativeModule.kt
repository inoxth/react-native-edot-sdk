package com.edot.reactnative

import com.facebook.react.bridge.*
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.StatusCode
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class EdotReactNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var isInitialized = false
        private var debugEnabled = false

        fun debugLog(message: String) {
            if (debugEnabled) {
                android.util.Log.d("EDOT", message)
            }
        }
    }

    private val activeSpans = ConcurrentHashMap<String, Span>()

    override fun getName(): String = "EdotReactNative"

    @ReactMethod
    fun initialize(config: ReadableMap, promise: Promise) {
        if (isInitialized) {
            debugLog("Already initialized, merging JS config")
            promise.resolve(null)
            return
        }

        try {
            debugEnabled = config.getBooleanSafe("debug", false)

            // The EDOT Android agent is initialized by the Gradle plugin
            // (co.elastic.otel.android.agent) at app startup. This JS-side
            // initialize() registers JS-specific config and confirms readiness.

            isInitialized = true
            debugLog("SDK initialized successfully")
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("EDOT_INIT_ERROR", "Failed to initialize EDOT: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getCurrentSessionId(promise: Promise) {
        promise.resolve("")
    }

    @ReactMethod
    fun setUser(userInfo: ReadableMap) {
        debugLog("setUser: ${userInfo.getString("id")}")
    }

    @ReactMethod
    fun clearUser() {
        debugLog("clearUser")
    }

    @ReactMethod
    fun setSessionAttribute(key: String, value: String) {
        debugLog("setSessionAttribute: $key=$value")
    }

    @ReactMethod
    fun setGlobalAttribute(key: String, value: String) {
        debugLog("setGlobalAttribute: $key=$value")
    }

    @ReactMethod
    fun removeGlobalAttribute(key: String) {
        debugLog("removeGlobalAttribute: $key")
    }

    @ReactMethod
    fun reportJsException(errorInfo: ReadableMap) {
        val name = errorInfo.getString("name") ?: "Unknown"
        val message = errorInfo.getString("message") ?: ""
        debugLog("JS Exception: $name: $message")
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startSpan(name: String, attributes: ReadableMap, parentSpanId: String?): String {
        val tracer = try {
            GlobalOpenTelemetry.getTracer("react-native-edot")
        } catch (e: Exception) {
            return UUID.randomUUID().toString()
        }

        val spanBuilder = tracer.spanBuilder(name)

        if (parentSpanId != null) {
            val parentSpan = activeSpans[parentSpanId]
            if (parentSpan != null) {
                spanBuilder.setParent(
                    io.opentelemetry.context.Context.current().with(parentSpan)
                )
            }
        }

        val iterator = attributes.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (attributes.getType(key)) {
                ReadableType.String -> spanBuilder.setAttribute(key, attributes.getString(key)!!)
                ReadableType.Number -> spanBuilder.setAttribute(key, attributes.getDouble(key))
                ReadableType.Boolean -> spanBuilder.setAttribute(key, attributes.getBoolean(key))
                else -> {}
            }
        }

        val span = spanBuilder.startSpan()
        val spanId = UUID.randomUUID().toString()
        activeSpans[spanId] = span
        return spanId
    }

    @ReactMethod
    fun endSpan(spanId: String, statusCode: Double) {
        val span = activeSpans.remove(spanId) ?: return
        when (statusCode.toInt()) {
            2 -> span.setStatus(StatusCode.ERROR)
            else -> span.setStatus(StatusCode.OK)
        }
        span.end()
    }

    @ReactMethod
    fun setSpanAttribute(spanId: String, key: String, value: Dynamic) {
        val span = activeSpans[spanId] ?: return
        when (value.type) {
            ReadableType.String -> span.setAttribute(key, value.asString())
            ReadableType.Number -> span.setAttribute(key, value.asDouble())
            ReadableType.Boolean -> span.setAttribute(key, value.asBoolean())
            else -> {}
        }
    }

    @ReactMethod
    fun recordSpanException(spanId: String, errorInfo: ReadableMap) {
        val span = activeSpans[spanId] ?: return
        val message = errorInfo.getString("message") ?: "Unknown error"
        span.addEvent(
            "exception",
            Attributes.builder()
                .put("exception.message", message)
                .put("exception.type", errorInfo.getString("name") ?: "Error")
                .put("exception.stacktrace", errorInfo.getString("stack") ?: "")
                .build()
        )
    }

    @ReactMethod
    fun recordMetric(name: String, value: Double, attributes: ReadableMap, metricType: String) {
        val meter = try {
            GlobalOpenTelemetry.getMeter("react-native-edot")
        } catch (e: Exception) {
            return
        }

        val attrsBuilder = Attributes.builder()
        val iterator = attributes.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (attributes.getType(key) == ReadableType.String) {
                attrsBuilder.put(key, attributes.getString(key)!!)
            }
        }
        val attrs = attrsBuilder.build()

        when (metricType) {
            "counter" -> meter.counterBuilder(name).build().add(value.toLong(), attrs)
            "histogram" -> meter.histogramBuilder(name).build().record(value, attrs)
            "upDownCounter" -> meter.upDownCounterBuilder(name).build().add(value.toLong(), attrs)
            else -> debugLog("Unknown metric type: $metricType")
        }
    }

    @ReactMethod
    fun emitLog(severity: String, message: String, attributes: ReadableMap) {
        debugLog("[$severity] $message")
    }

    @ReactMethod
    fun setTrackingConsent(consent: String) {
        debugLog("setTrackingConsent: $consent")
    }

    private fun ReadableMap.getBooleanSafe(key: String, default: Boolean): Boolean {
        return if (hasKey(key)) getBoolean(key) else default
    }
}
