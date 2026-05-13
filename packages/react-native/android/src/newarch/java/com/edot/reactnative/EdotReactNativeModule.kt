package com.edot.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

class EdotReactNativeModule(reactContext: ReactApplicationContext) :
    NativeEdotReactNativeSpec(reactContext) {

    private val impl = EdotReactNativeModuleImpl(reactContext)

    override fun getName(): String = EdotReactNativeModuleImpl.NAME

    override fun initialize(config: ReadableMap, promise: Promise) =
        impl.initialize(config, promise)

    override fun getCurrentSessionId(promise: Promise) = impl.getCurrentSessionId(promise)

    override fun setUser(userInfo: ReadableMap) = impl.setUser(userInfo)

    override fun clearUser() = impl.clearUser()

    override fun setSessionAttribute(key: String, value: String) =
        impl.setSessionAttribute(key, value)

    override fun setGlobalAttribute(key: String, value: String) =
        impl.setGlobalAttribute(key, value)

    override fun removeGlobalAttribute(key: String) = impl.removeGlobalAttribute(key)

    override fun reportJsException(errorInfo: ReadableMap) = impl.reportJsException(errorInfo)

    override fun startSpan(
        name: String,
        attributes: ReadableMap,
        parentSpanId: String?,
        instrumentationName: String?,
    ): String = impl.startSpan(name, attributes, parentSpanId, instrumentationName)

    override fun startClientSpan(
        name: String,
        attributes: ReadableMap,
        parentSpanId: String?,
        instrumentationName: String?,
    ): String = impl.startClientSpan(name, attributes, parentSpanId, instrumentationName)

    override fun getTraceparent(spanHandle: String): String = impl.getTraceparent(spanHandle)

    override fun endSpan(spanId: String, statusCode: Double) = impl.endSpan(spanId, statusCode)

    override fun setSpanAttribute(spanId: String, key: String, value: String) =
        impl.setSpanAttribute(spanId, key, value)

    override fun setSpanAttributeNumber(spanId: String, key: String, value: Double) =
        impl.setSpanAttributeNumber(spanId, key, value)

    override fun setSpanAttributeBoolean(spanId: String, key: String, value: Boolean) =
        impl.setSpanAttributeBoolean(spanId, key, value)

    override fun recordSpanException(spanId: String, errorInfo: ReadableMap) =
        impl.recordSpanException(spanId, errorInfo)

    override fun recordMetric(
        name: String,
        value: Double,
        attributes: ReadableMap,
        metricType: String,
    ) = impl.recordMetric(name, value, attributes, metricType)

    override fun emitLog(severity: String, message: String, attributes: ReadableMap) =
        impl.emitLog(severity, message, attributes)

    override fun setTrackingConsent(consent: String) = impl.setTrackingConsent(consent)
}
