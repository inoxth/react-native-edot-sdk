package com.edot.reactnative

import android.app.Application
import com.facebook.react.bridge.*
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.logs.Severity
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.StatusCode
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class EdotReactNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var isInitialized = false
        private var debugEnabled = false

        private val userAttributes = ConcurrentHashMap<String, String>()
        private val sessionAttributes = ConcurrentHashMap<String, String>()
        private val globalAttributes = ConcurrentHashMap<String, String>()

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

            val serverUrl = config.getStringSafe("serverUrl") ?: ""
            if (serverUrl.isBlank()) {
                promise.reject("EDOT_INIT_ERROR", "Invalid serverUrl: $serverUrl", null as Throwable?)
                return
            }

            if (!EdotReactNativeAgent.isPreInitialized) {
                val application = reactApplicationContext.applicationContext as Application
                EdotReactNativeAgent.buildFromJsConfig(
                    application = application,
                    serverUrl = serverUrl,
                    secretToken = config.getStringSafe("secretToken"),
                    apiKey = config.getStringSafe("apiKey"),
                    sessionSamplingRate = config.getDoubleSafe("sessionSamplingRate"),
                    connectionType = config.getStringSafe("connectionType"),
                    serviceName = config.getStringSafe("serviceName"),
                    serviceVersion = config.getStringSafe("serviceVersion"),
                    deploymentEnvironment = config.getStringSafe("deploymentEnvironment"),
                )
            }

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
        userInfo.getStringSafe("id")?.let { userAttributes["enduser.id"] = it }
        userInfo.getStringSafe("email")?.let { userAttributes["enduser.email"] = it }
        userInfo.getStringSafe("name")?.let { userAttributes["enduser.name"] = it }
    }

    @ReactMethod
    fun clearUser() {
        userAttributes.clear()
    }

    @ReactMethod
    fun setSessionAttribute(key: String, value: String) {
        sessionAttributes[key] = value
    }

    @ReactMethod
    fun setGlobalAttribute(key: String, value: String) {
        globalAttributes[key] = value
    }

    @ReactMethod
    fun removeGlobalAttribute(key: String) {
        globalAttributes.remove(key)
    }

    @ReactMethod
    fun reportJsException(errorInfo: ReadableMap) {
        val name = errorInfo.getStringSafe("name") ?: "Unknown"
        val message = errorInfo.getStringSafe("message") ?: ""
        val stack = errorInfo.getStringSafe("stack") ?: ""
        val isFatal = errorInfo.getBooleanSafe("isFatal", false)

        val tracer = EdotReactNativeAgent.openTelemetry?.getTracer("react-native-edot") ?: run {
            debugLog("OpenTelemetry not available; skipping reportJsException")
            return
        }

        val span = tracer.spanBuilder("js_error: $name")
            .setAttribute("exception.type", name)
            .setAttribute("exception.message", message)
            .setAttribute("exception.stacktrace", stack)
            .setAttribute("error.is_fatal", isFatal)
            .startSpan()
        span.setStatus(StatusCode.ERROR, message)
        span.end()
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startSpan(name: String, attributes: ReadableMap, parentSpanId: String?): String {
        val tracer = EdotReactNativeAgent.openTelemetry?.getTracer("react-native-edot") ?: run {
            debugLog("OpenTelemetry not available; returning stub span id")
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

        for ((key, value) in globalAttributes) {
            spanBuilder.setAttribute(key, value)
        }
        for ((key, value) in sessionAttributes) {
            spanBuilder.setAttribute(key, value)
        }
        for ((key, value) in userAttributes) {
            spanBuilder.setAttribute(key, value)
        }

        val span = spanBuilder.startSpan()
        val spanId = UUID.randomUUID().toString()
        activeSpans[spanId] = span
        return spanId
    }

    @ReactMethod
    fun endSpan(spanId: String, statusCode: Double) {
        val span = activeSpans.remove(spanId) ?: return
        // OTel StatusCode: 1=Ok, 2=Error
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
        val message = errorInfo.getStringSafe("message") ?: "Unknown error"
        span.addEvent(
            "exception",
            Attributes.builder()
                .put("exception.message", message)
                .put("exception.type", errorInfo.getStringSafe("name") ?: "Error")
                .put("exception.stacktrace", errorInfo.getStringSafe("stack") ?: "")
                .build()
        )
    }

    @ReactMethod
    fun recordMetric(name: String, value: Double, attributes: ReadableMap, metricType: String) {
        val meter = EdotReactNativeAgent.openTelemetry?.getMeter("react-native-edot") ?: run {
            debugLog("OpenTelemetry not available; skipping recordMetric")
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
        val otel = EdotReactNativeAgent.openTelemetry ?: run {
            debugLog("OpenTelemetry not available; skipping emitLog [$severity] $message")
            return
        }

        val logger = otel.logsBridge.loggerBuilder("react-native-edot").build()
        val builder = logger.logRecordBuilder()
        builder.setBody(message)
        builder.setSeverity(mapSeverity(severity))

        val iterator = attributes.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (attributes.getType(key) == ReadableType.String) {
                builder.setAttribute(
                    io.opentelemetry.api.common.AttributeKey.stringKey(key),
                    attributes.getString(key) ?: "",
                )
            }
        }

        builder.emit()
    }

    @ReactMethod
    fun setTrackingConsent(consent: String) {
        android.util.Log.i("EDOT", "setTrackingConsent($consent) called but not supported by native SDK")
    }

    private fun mapSeverity(severity: String): Severity = when (severity) {
        "trace" -> Severity.TRACE
        "debug" -> Severity.DEBUG
        "info" -> Severity.INFO
        "warn" -> Severity.WARN
        "error" -> Severity.ERROR
        "fatal" -> Severity.FATAL
        else -> Severity.INFO
    }

    private fun ReadableMap.getBooleanSafe(key: String, default: Boolean): Boolean {
        return if (hasKey(key)) getBoolean(key) else default
    }

    private fun ReadableMap.getStringSafe(key: String): String? {
        return if (hasKey(key)) getString(key) else null
    }

    private fun ReadableMap.getDoubleSafe(key: String): Double? {
        return if (hasKey(key) && getType(key) == ReadableType.Number) getDouble(key) else null
    }
}
