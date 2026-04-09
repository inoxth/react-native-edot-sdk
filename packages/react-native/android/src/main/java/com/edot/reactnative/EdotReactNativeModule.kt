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

            // Store service identity as global attributes (applied to all spans)
            config.getStringSafe("serviceName")?.let { globalAttributes["service.name"] = it }
            config.getStringSafe("serviceVersion")?.let { globalAttributes["service.version"] = it }
            config.getStringSafe("deploymentEnvironment")?.let { globalAttributes["deployment.environment"] = it }

            // The EDOT Android agent is initialized by the Gradle plugin
            // (co.elastic.otel.android.agent) at app startup. Runtime config
            // (serverUrl, auth, sampling) is handled by the plugin configuration.

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

        val tracer = try {
            GlobalOpenTelemetry.getTracer("react-native-edot")
        } catch (e: Exception) {
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
        val logger = try {
            GlobalOpenTelemetry.get().logsBridge
                .loggerBuilder("react-native-edot")
                .build()
        } catch (e: Exception) {
            debugLog("[$severity] $message")
            return
        }

        val builder = logger.logRecordBuilder()
        builder.setBody(message)

        val iterator = attributes.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (attributes.getType(key) == ReadableType.String) {
                builder.setAttribute(io.opentelemetry.api.common.AttributeKey.stringKey(key), attributes.getString(key)!!)
            }
        }

        builder.emit()
    }

    @ReactMethod
    fun setTrackingConsent(consent: String) {
        android.util.Log.i("EDOT", "setTrackingConsent($consent) called but not supported by native SDK")
    }

    private fun ReadableMap.getBooleanSafe(key: String, default: Boolean): Boolean {
        return if (hasKey(key)) getBoolean(key) else default
    }

    private fun ReadableMap.getStringSafe(key: String): String? {
        return if (hasKey(key)) getString(key) else null
    }
}
