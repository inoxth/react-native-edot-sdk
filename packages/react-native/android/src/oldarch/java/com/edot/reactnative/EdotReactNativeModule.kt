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
    fun setUser(userInfo: ReadableMap) = impl.setUser(userInfo)

    @ReactMethod
    fun clearUser() = impl.clearUser()

    @ReactMethod
    fun setSessionAttribute(key: String, value: String) = impl.setSessionAttribute(key, value)

    @ReactMethod
    fun setGlobalAttribute(key: String, value: String) = impl.setGlobalAttribute(key, value)

    @ReactMethod
    fun removeGlobalAttribute(key: String) = impl.removeGlobalAttribute(key)

    @ReactMethod
    fun reportJsException(errorInfo: ReadableMap) = impl.reportJsException(errorInfo)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startSpan(name: String, attributes: ReadableMap, parentSpanId: String?): String =
        impl.startSpan(name, attributes, parentSpanId)

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
