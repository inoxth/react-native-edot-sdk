package com.edot.reactnative

import android.app.Application
import co.elastic.otel.android.ElasticApmAgent
import co.elastic.otel.android.connectivity.Authentication
import co.elastic.otel.android.exporters.configuration.ExportProtocol
import co.elastic.otel.android.features.diskbuffering.DiskBufferingConfiguration
import co.elastic.otel.android.interceptor.Interceptor
import io.opentelemetry.api.OpenTelemetry
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.sdk.logs.export.LogRecordExporter
import io.opentelemetry.sdk.trace.export.SpanExporter
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
        apiKey: String? = null,
        sessionSamplingRate: Double? = null,
        exportProtocol: String? = null,
        diskBufferingEnabled: Boolean? = null,
    ) {
        require(serverUrl.isNotBlank()) { "[EDOT] serverUrl must not be blank" }
        requireResourceIdentity("serviceName", serviceName)
        requireResourceIdentity("serviceVersion", serviceVersion)
        requireResourceIdentity("deploymentEnvironment", deploymentEnvironment)
        requireMutuallyExclusiveCredentials(secretToken, apiKey)
        requireValidSamplingRate(sessionSamplingRate)

        if (!preInitialized.compareAndSet(false, true)) return

        val builder = ElasticApmAgent.builder(application)
            .setExportUrl(serverUrl)
            .setServiceName(serviceName)
            .setServiceVersion(serviceVersion)
            .setDeploymentEnvironment(deploymentEnvironment)
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
        attachSpanAttributesInterceptor(builder)

        val builtAgent = builder.build()
        agent = builtAgent
        val openTelemetry = builtAgent.getOpenTelemetry()
        installAppMetrics(application, openTelemetry)
        installSystemMetrics(openTelemetry)
    }

    private fun requireResourceIdentity(name: String, value: String) {
        require(value.isNotBlank()) { "[EDOT] $name must not be blank" }
        require(!value.contains(',') && !value.contains('=')) {
            "[EDOT] $name must not contain ',' or '=' characters (got: $value)"
        }
    }

    private fun requireMutuallyExclusiveCredentials(secretToken: String?, apiKey: String?) {
        val hasToken = !secretToken.isNullOrBlank()
        val hasKey = !apiKey.isNullOrBlank()
        require(!(hasToken && hasKey)) {
            "[EDOT] secretToken and apiKey are mutually exclusive"
        }
    }

    private fun requireValidSamplingRate(rate: Double?) {
        if (rate == null) return
        require(rate in 0.0..1.0) {
            "[EDOT] sessionSamplingRate must be between 0.0 and 1.0 (got: $rate)"
        }
    }

    private fun attachSpanAttributesInterceptor(builder: ElasticApmAgent.Builder) {
        builder.addSpanAttributesInterceptor(
            Interceptor<Attributes> { existing ->
                EdotReactNativeModuleImpl.mergeUserSessionGlobalAttributes(existing)
            }
        )
    }

    private fun installAppMetrics(application: Application, openTelemetry: OpenTelemetry) {
        EdotAppMetrics.install(application, openTelemetry)
    }

    private fun installSystemMetrics(openTelemetry: OpenTelemetry) {
        EdotSystemMetrics.install(openTelemetry)
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
        spanAttributeRedactor: Interceptor<Attributes>? = null,
        logAttributeRedactor: Interceptor<Attributes>? = null,
        spanExporterFilter: Interceptor<SpanExporter>? = null,
        logExporterFilter: Interceptor<LogRecordExporter>? = null,
        enableAppMetrics: Boolean = true,
        enableSystemMetrics: Boolean = true,
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
        attachSpanAttributesInterceptor(builder)
        // User-supplied redactors are registered AFTER the user/session/global
        // interceptor so consumers can drop or mask values we just injected
        // (e.g. user.email). Mirrors iOS ordering in EdotReactNative.swift.
        spanAttributeRedactor?.let { builder.addSpanAttributesInterceptor(it) }
        logAttributeRedactor?.let { builder.addLogRecordAttributesInterceptor(it) }
        spanExporterFilter?.let { builder.addSpanExporterInterceptor(it) }
        logExporterFilter?.let { builder.addLogRecordExporterInterceptor(it) }

        return builder.build().also {
            agent = it
            val openTelemetry = it.getOpenTelemetry()
            if (enableAppMetrics) {
                installAppMetrics(application, openTelemetry)
            }
            if (enableSystemMetrics) {
                installSystemMetrics(openTelemetry)
            }
        }
    }
}
