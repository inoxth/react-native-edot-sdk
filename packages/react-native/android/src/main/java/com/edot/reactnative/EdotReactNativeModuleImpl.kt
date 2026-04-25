package com.edot.reactnative

import android.app.Application
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.logs.Severity
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanBuilder
import io.opentelemetry.api.trace.StatusCode
import java.util.Collections
import java.util.LinkedHashMap
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class EdotReactNativeModuleImpl(private val reactContext: ReactApplicationContext) {

    enum class UserAttributesSpanScope {
        ALL,
        ID_ONLY,
        NONE;

        companion object {
            fun parse(raw: String?): UserAttributesSpanScope = when (raw) {
                "all" -> ALL
                "none" -> NONE
                else -> ID_ONLY
            }
        }
    }

    enum class TrackingConsent {
        GRANTED,
        NOT_GRANTED,
        PENDING;

        val allowsEmission: Boolean
            get() = this == GRANTED

        companion object {
            fun parse(raw: String?): TrackingConsent = when (raw) {
                "not_granted" -> NOT_GRANTED
                "pending" -> PENDING
                else -> GRANTED
            }
        }
    }

    companion object {
        const val NAME = "EdotReactNative"

        @Volatile
        private var isInitialized = false
        @Volatile
        private var debugEnabled = false
        private var userAttributesSpanScope = UserAttributesSpanScope.ID_ONLY

        @Volatile
        private var trackingConsent = TrackingConsent.GRANTED

        private val userAttributes = ConcurrentHashMap<String, String>()
        private val sessionAttributes = ConcurrentHashMap<String, String>()
        private val globalAttributes = ConcurrentHashMap<String, String>()

        fun debugLog(message: String) {
            if (debugEnabled) {
                android.util.Log.d("EDOT", message)
            }
        }

        fun emissionAllowed(): Boolean = trackingConsent.allowsEmission
    }

    private val activeSpans: MutableMap<String, Span> = Collections.synchronizedMap(
        object : LinkedHashMap<String, Span>(16, 0.75f, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Span>): Boolean {
                val evict = size > 512
                if (evict) eldest.value.end()
                return evict
            }
        }
    )

    fun initialize(config: ReadableMap, promise: Promise) {
        if (isInitialized) {
            debugLog("Already initialized, merging JS config")
            promise.resolve(null)
            return
        }

        try {
            debugEnabled = config.getBooleanSafe("debug", false)
            userAttributesSpanScope = UserAttributesSpanScope.parse(
                config.getStringSafe("userAttributesIncludeInSpans")
            )
            trackingConsent = TrackingConsent.parse(
                config.getStringSafe("trackingConsent")
            )

            val serverUrl = config.getStringSafe("serverUrl") ?: ""
            if (serverUrl.isBlank()) {
                promise.reject("EDOT_INIT_ERROR", "Invalid serverUrl: $serverUrl")
                return
            }

            if (!EdotReactNativeAgent.isPreInitialized) {
                val application = reactContext.applicationContext as Application
                EdotReactNativeAgent.buildFromJsConfig(
                    application = application,
                    serverUrl = serverUrl,
                    secretToken = config.getStringSafe("secretToken"),
                    apiKey = config.getStringSafe("apiKey"),
                    sessionSamplingRate = config.getDoubleSafe("sessionSamplingRate"),
                    exportProtocol = config.getStringSafe("exportProtocol"),
                    diskBufferingEnabled = config.getBooleanOrNull("diskBufferingEnabled"),
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

    fun getCurrentSessionId(promise: Promise) {
        // ElasticApmAgent 1.5.0 exposes SessionManager only as an internal
        // $agent_sdk API with no public accessor. Returns empty until
        // upstream adds a public SessionProvider/SessionManager getter.
        promise.resolve("")
    }

    fun setUser(userInfo: ReadableMap) {
        userInfo.getStringSafe("id")?.let { userAttributes["enduser.id"] = it }
        userInfo.getStringSafe("email")?.let { userAttributes["enduser.email"] = it }
        userInfo.getStringSafe("name")?.let { userAttributes["enduser.name"] = it }
    }

    fun clearUser() {
        userAttributes.clear()
    }

    fun setSessionAttribute(key: String, value: String) {
        sessionAttributes[key] = value
    }

    fun setGlobalAttribute(key: String, value: String) {
        globalAttributes[key] = value
    }

    fun removeGlobalAttribute(key: String) {
        globalAttributes.remove(key)
    }

    fun reportJsException(errorInfo: ReadableMap) {
        if (!emissionAllowed()) return
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

    fun startSpan(name: String, attributes: ReadableMap, parentSpanId: String?): String {
        if (!emissionAllowed()) return ""
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
                ReadableType.Number -> spanBuilder.setNumericAttribute(key, attributes.getDouble(key))
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
        for ((key, value) in filteredUserAttributesForSpan()) {
            spanBuilder.setAttribute(key, value)
        }

        val span = spanBuilder.startSpan()
        val spanId = UUID.randomUUID().toString()
        activeSpans[spanId] = span
        return spanId
    }

    fun endSpan(spanId: String, statusCode: Double) {
        val span = activeSpans.remove(spanId) ?: return
        if (!emissionAllowed()) return
        // OTel StatusCode: 1=Ok, 2=Error
        when (statusCode.toInt()) {
            2 -> span.setStatus(StatusCode.ERROR)
            else -> span.setStatus(StatusCode.OK)
        }
        span.end()
    }

    fun setSpanAttribute(spanId: String, key: String, value: String) {
        if (!emissionAllowed()) return
        val span = activeSpans[spanId] ?: return
        span.setAttribute(key, value)
    }

    fun setSpanAttributeNumber(spanId: String, key: String, value: Double) {
        if (!emissionAllowed()) return
        val span = activeSpans[spanId] ?: return
        span.setNumericAttribute(key, value)
    }

    fun setSpanAttributeBoolean(spanId: String, key: String, value: Boolean) {
        if (!emissionAllowed()) return
        val span = activeSpans[spanId] ?: return
        span.setAttribute(key, value)
    }

    fun recordSpanException(spanId: String, errorInfo: ReadableMap) {
        if (!emissionAllowed()) return
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

    fun recordMetric(name: String, value: Double, attributes: ReadableMap, metricType: String) {
        if (!emissionAllowed()) return
        val meter = EdotReactNativeAgent.openTelemetry?.getMeter("react-native-edot") ?: run {
            debugLog("OpenTelemetry not available; skipping recordMetric")
            return
        }

        val attrsBuilder = Attributes.builder()
        val iterator = attributes.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (attributes.getType(key)) {
                ReadableType.String -> attrsBuilder.put(
                    io.opentelemetry.api.common.AttributeKey.stringKey(key),
                    attributes.getString(key)!!
                )
                ReadableType.Number -> {
                    val d = attributes.getDouble(key)
                    if (isIntegerValued(d)) attrsBuilder.put(
                        io.opentelemetry.api.common.AttributeKey.longKey(key), d.toLong()
                    ) else attrsBuilder.put(
                        io.opentelemetry.api.common.AttributeKey.doubleKey(key), d
                    )
                }
                ReadableType.Boolean -> attrsBuilder.put(
                    io.opentelemetry.api.common.AttributeKey.booleanKey(key),
                    attributes.getBoolean(key)
                )
                else -> android.util.Log.w("EDOT", "recordMetric: skipping attribute '$key' — unsupported type")
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

    fun emitLog(severity: String, message: String, attributes: ReadableMap) {
        if (!emissionAllowed()) return
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

    fun setTrackingConsent(consent: String) {
        trackingConsent = TrackingConsent.parse(consent)
    }

    private fun filteredUserAttributesForSpan(): Map<String, String> = when (userAttributesSpanScope) {
        UserAttributesSpanScope.ALL -> userAttributes
        UserAttributesSpanScope.ID_ONLY ->
            userAttributes["enduser.id"]?.let { mapOf("enduser.id" to it) } ?: emptyMap()
        UserAttributesSpanScope.NONE -> emptyMap()
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

    private fun ReadableMap.getBooleanOrNull(key: String): Boolean? {
        return if (hasKey(key) && getType(key) == ReadableType.Boolean) getBoolean(key) else null
    }

    private fun isIntegerValued(value: Double): Boolean =
        value.isFinite() && value == value.toLong().toDouble()

    private fun SpanBuilder.setNumericAttribute(key: String, value: Double): SpanBuilder =
        if (isIntegerValued(value)) setAttribute(key, value.toLong()) else setAttribute(key, value)

    private fun Span.setNumericAttribute(key: String, value: Double): Span =
        if (isIntegerValued(value)) setAttribute(key, value.toLong()) else setAttribute(key, value)
}
