package com.edot.reactnative

import android.app.Application

object EdotReactNativeAgent {

    private var preInitialized = false

    /**
     * Pre-initialize the EDOT agent for early crash capture.
     * The EDOT Android Gradle plugin (co.elastic.otel.android.agent) handles
     * actual agent initialization. This method records that pre-init was requested
     * so the JS-side initialize() knows not to duplicate setup.
     */
    @JvmStatic
    fun preInitialize(application: Application) {
        if (preInitialized) return
        preInitialized = true
    }

    @JvmStatic
    val isPreInitialized: Boolean
        get() = preInitialized
}
