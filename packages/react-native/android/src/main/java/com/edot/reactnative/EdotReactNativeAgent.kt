package com.edot.reactnative

import android.app.Application
import co.elastic.otel.android.ElasticApmAgent
import co.elastic.otel.android.connectivity.Authentication
import co.elastic.otel.android.exporters.configuration.ExportProtocol
import io.opentelemetry.api.OpenTelemetry

object EdotReactNativeAgent {

    private var agent: ElasticApmAgent? = null
    private var preInitialized = false

    @JvmStatic
    val isPreInitialized: Boolean
        get() = preInitialized

    internal val openTelemetry: OpenTelemetry?
        get() = agent?.getOpenTelemetry()

    @JvmStatic
    @JvmOverloads
    fun preInitialize(
        application: Application,
        serverUrl: String,
        secretToken: String? = null,
        serviceName: String? = null,
        serviceVersion: String? = null,
        deploymentEnvironment: String? = null,
    ) {
        if (preInitialized) return
        if (serverUrl.isBlank()) return

        val builder = ElasticApmAgent.builder(application).setExportUrl(serverUrl)
        secretToken?.takeIf { it.isNotBlank() }?.let {
            builder.setExportAuthentication(Authentication.SecretToken(it))
        }
        serviceName?.takeIf { it.isNotBlank() }?.let { builder.setServiceName(it) }
        serviceVersion?.takeIf { it.isNotBlank() }?.let { builder.setServiceVersion(it) }
        deploymentEnvironment?.takeIf { it.isNotBlank() }?.let { builder.setDeploymentEnvironment(it) }

        agent = builder.build()
        preInitialized = true
    }

    internal fun buildFromJsConfig(
        application: Application,
        serverUrl: String,
        secretToken: String?,
        apiKey: String?,
        sessionSamplingRate: Double?,
        connectionType: String?,
        serviceName: String?,
        serviceVersion: String?,
        deploymentEnvironment: String?,
    ): ElasticApmAgent {
        val builder = ElasticApmAgent.builder(application).setExportUrl(serverUrl)
        secretToken?.takeIf { it.isNotBlank() }?.let {
            builder.setExportAuthentication(Authentication.SecretToken(it))
        }
        apiKey?.takeIf { it.isNotBlank() }?.let {
            builder.setExportAuthentication(Authentication.ApiKey(it))
        }
        sessionSamplingRate?.let { builder.setSessionSampleRate(it) }
        connectionType?.let {
            builder.setExportProtocol(
                if (it == "grpc") ExportProtocol.GRPC else ExportProtocol.HTTP
            )
        }
        serviceName?.takeIf { it.isNotBlank() }?.let { builder.setServiceName(it) }
        serviceVersion?.takeIf { it.isNotBlank() }?.let { builder.setServiceVersion(it) }
        deploymentEnvironment?.takeIf { it.isNotBlank() }?.let { builder.setDeploymentEnvironment(it) }

        return builder.build().also { agent = it }
    }
}
