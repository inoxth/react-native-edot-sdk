package com.edot.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class EdotReactNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val impl = EdotReactNativeModuleImpl(reactContext)

    override fun getName(): String = EdotReactNativeModuleImpl.NAME

    @ReactMethod
    fun initialize(config: ReadableMap, promise: Promise) = impl.initialize(config, promise)

    @ReactMethod
    fun getCurrentSessionId(promise: Promise) = impl.getCurrentSessionId(promise)

    @ReactMethod
    fun reportJsException(errorInfo: ReadableMap) = impl.reportJsException(errorInfo)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startSpan(
        name: String,
        attributes: ReadableMap,
        parentSpanId: String?,
        instrumentationName: String?,
    ): String = impl.startSpan(name, attributes, parentSpanId, instrumentationName)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startClientSpan(
        name: String,
        attributes: ReadableMap,
        parentSpanId: String?,
        instrumentationName: String?,
    ): String = impl.startClientSpan(name, attributes, parentSpanId, instrumentationName)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getTraceparent(spanHandle: String): String = impl.getTraceparent(spanHandle)

    @ReactMethod
    fun endSpan(spanId: String, statusCode: Double) = impl.endSpan(spanId, statusCode)

    @ReactMethod
    fun setSpanAttribute(spanId: String, key: String, value: String) =
        impl.setSpanAttribute(spanId, key, value)

    @ReactMethod
    fun setSpanAttributeNumber(spanId: String, key: String, value: Double) =
        impl.setSpanAttributeNumber(spanId, key, value)

    @ReactMethod
    fun setSpanAttributeBoolean(spanId: String, key: String, value: Boolean) =
        impl.setSpanAttributeBoolean(spanId, key, value)

    @ReactMethod
    fun recordSpanException(spanId: String, errorInfo: ReadableMap) =
        impl.recordSpanException(spanId, errorInfo)

    @ReactMethod
    fun recordMetric(name: String, value: Double, attributes: ReadableMap, metricType: String) =
        impl.recordMetric(name, value, attributes, metricType)

    @ReactMethod
    fun emitLog(severity: String, message: String, attributes: ReadableMap) =
        impl.emitLog(severity, message, attributes)

    @ReactMethod
    fun setTrackingConsent(consent: String) = impl.setTrackingConsent(consent)
}
