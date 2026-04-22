package com.edot.reactnative

import android.app.Application
import co.elastic.otel.android.ElasticApmAgent
import co.elastic.otel.android.connectivity.Authentication
import co.elastic.otel.android.exporters.configuration.ExportProtocol
import co.elastic.otel.android.features.diskbuffering.DiskBufferingConfiguration
import io.opentelemetry.api.OpenTelemetry
import java.util.concurrent.atomic.AtomicBoolean

object EdotReactNativeAgent {

    private var agent: ElasticApmAgent? = null
    private val preInitialized = AtomicBoolean(false)

    @JvmStatic
    val isPreInitialized: Boolean
        get() = preInitialized.get()

    internal val openTelemetry: OpenTelemetry?
        get() = agent?.getOpenTelemetry()

    @JvmStatic
    @JvmOverloads
    fun preInitialize(
        application: Application,
        serverUrl: String,
        serviceName: String,
        serviceVersion: String,
        deploymentEnvironment: String,
        secretToken: String? = null,
    ) {
        require(serverUrl.isNotBlank()) { "[EDOT] serverUrl must not be blank" }
        requireResourceIdentity("serviceName", serviceName)
        requireResourceIdentity("serviceVersion", serviceVersion)
        requireResourceIdentity("deploymentEnvironment", deploymentEnvironment)

        if (!preInitialized.compareAndSet(false, true)) return

        val builder = ElasticApmAgent.builder(application)
            .setExportUrl(serverUrl)
            .setServiceName(serviceName)
            .setServiceVersion(serviceVersion)
            .setDeploymentEnvironment(deploymentEnvironment)
        secretToken?.takeIf { it.isNotBlank() }?.let {
            builder.setExportAuthentication(Authentication.SecretToken(it))
        }

        agent = builder.build()
    }

    private fun requireResourceIdentity(name: String, value: String) {
        require(value.isNotBlank()) { "[EDOT] $name must not be blank" }
        require(!value.contains(',') && !value.contains('=')) {
            "[EDOT] $name must not contain ',' or '=' characters (got: $value)"
        }
    }

    internal fun buildFromJsConfig(
        application: Application,
        serverUrl: String,
        secretToken: String?,
        apiKey: String?,
        sessionSamplingRate: Double?,
        exportProtocol: String?,
        diskBufferingEnabled: Boolean?,
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
        exportProtocol?.let {
            builder.setExportProtocol(
                if (it == "grpc") ExportProtocol.GRPC else ExportProtocol.HTTP
            )
        }
        diskBufferingEnabled?.let {
            builder.setDiskBufferingConfiguration(
                if (it) DiskBufferingConfiguration.enabled() else DiskBufferingConfiguration.disabled()
            )
        }
        serviceName?.takeIf { it.isNotBlank() }?.let { builder.setServiceName(it) }
        serviceVersion?.takeIf { it.isNotBlank() }?.let { builder.setServiceVersion(it) }
        deploymentEnvironment?.takeIf { it.isNotBlank() }?.let { builder.setDeploymentEnvironment(it) }

        return builder.build().also { agent = it }
    }
}
