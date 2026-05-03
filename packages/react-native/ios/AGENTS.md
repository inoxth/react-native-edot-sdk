# AGENTS.md — iOS native module

## Overview

iOS half of `@inox/react-native-edot-sdk`. Swift module that bridges JS → `apm-agent-ios` v2.0.0 (via SPM `ElasticApm` product) and OpenTelemetry-Swift v2.2.1 (via `OpenTelemetryProtocolExporter` / `OpenTelemetryProtocolExporterHTTP` / `PersistenceExporter` products). All code is gated on `#if ELASTIC_APM_AVAILABLE` — set by the podspec when `spm_dependency` resolves.

## Files

| File | Role |
|---|---|
| `EdotReactNative.swift` | Main RN module. `@objc` bridge methods (`initialize`, `startSpan`, `endSpan`, `setSpanAttribute*`, `recordSpanException`, `recordMetric`, `emitLog`, `setUser`, `setSessionAttribute`, `setGlobalAttribute`, `reportJsException`, `setTrackingConsent`, `getCurrentSessionId`). 657 lines. |
| `EdotReactNative.m` | `RCT_EXTERN_MODULE` Obj-C bridge — exposes Swift selectors to legacy bridge; `RCTLegacyInteropModuleProvider` handles New Arch. |
| `EdotReactNativeAgent.swift` | Pre-init helper for AppDelegate. Validates resource identity, double-sets `deployment.environment` keys in `OTEL_RESOURCE_ATTRIBUTES`, calls `ElasticApmAgent.start(...)`. |
| `EdotMeterProviderFactory.swift` | Custom `MeterProvider` (replaces upstream global). Pipeline: `PeriodicMetricReader → Logging? → Persistence → CentralConfigGate → HTTP\|gRPC`. |
| `EdotCentralConfigMetricExporter.swift` | Wraps metric exporter; drops batches when `CentralConfig().data.recording == false`. |
| `EdotAppMetrics.swift` | `application.launch.time` histogram via MetricKit (`MXAppLaunchMetric`). Replaces `apm-agent-ios`'s `AppMetrics`. |
| `EdotSystemMetrics.swift` | `system.cpu.usage` + `system.memory.usage` observable gauges via Mach task APIs. Replaces `apm-agent-ios`'s system metrics. |

## Architecture (recent — see commits `8a470ae`, `7165460`, `d3b8050`)

### Why a custom `MeterProvider` exists

apm-agent-ios v2.0.0's `OpenTelemetryInitializer` builds the global `MeterProvider` **without** `.setResource(...)`. All metrics emitted through `OpenTelemetry.instance.meterProvider` land under `unknown_service:*`. We bypass the global and build a resource-aware `MeterProvider` in `EdotMeterProviderFactory.build(...)`. Traces and logs still use the apm-agent-ios global.

### Metric exporter pipeline (outer → inner)

```
PeriodicMetricReader (60s) → LoggingMetricExporter (debug only) → PersistenceMetricExporterDecorator → EdotCentralConfigMetricExporter → OtlpHttpMetricExporter | OtlpMetricExporter (gRPC)
```

- **60s interval is load-bearing** (`exportIntervalSeconds` constant). `PeriodicMetricReaderBuilder` defaults to 1s upstream — would hammer APM Server.
- **`Persistence`** writes to `Caches/elastic/` so failed exports replay on next success. Mirrors apm-agent-ios's persistence root for traces and logs (segregated internally by signal type).
- **`CentralConfigGate`** sits inside persistence: kill-switch is honored at flush time. Returns `.success` on the off-state so persistence buffers clear instead of retrying.
- **`View.builder().build()` registered against `.*` selector is load-bearing**: `opentelemetry-swift-core`'s `ViewRegistry.findViews` ignores per-`InstrumentType` defaults; without an explicit catch-all view, observable instruments register no storage and `collectAllMetrics()` returns empty.

### Transport selection

`(config["exportProtocol"] as? String) == "http" ? .http : .grpc`. **Default is gRPC** to match apm-agent-ios's trace/log default.
- HTTP: `OtlpHttpMetricExporter` → `<serverUrl>/v1/metrics`.
- gRPC: `OtlpMetricExporter(channel:)` over an NIO `MultiThreadedEventLoopGroup` + `GRPCChannel`. TLS auto-detected from URL scheme. Held in static `grpcResources` for process lifetime — no public teardown (matches apm-agent-ios's NIO group lifetime; OS reclaims at exit).

## Load-Bearing Rules

These rules have a documented "why" in source comments. Removing or relaxing any one **silently** breaks something.

1. **`#if ELASTIC_APM_AVAILABLE` guard** wraps every file's body. Compilation flag is set by `pod_target_xcconfig` only when `spm_dependency` resolves. Calling `ElasticApm` outside the guard breaks builds for consumers without SPM.
2. **`registerView(selector: ".*", view: View.builder().build())`** in `EdotMeterProviderFactory.build` — see above. (`EdotMeterProviderFactory.swift:30`)
3. **`exportIntervalSeconds = 60`** — do not reduce. (`EdotMeterProviderFactory.swift:54`)
4. **`assert(grpcResources == nil, …)`** in the `.grpc` branch of `makeBaseExporter` — calling `build(...)` twice with `.grpc` would drop the previous `EventLoopGroup` without `syncShutdownGracefully()`, tripping a NIO precondition in debug. `EdotReactNative.initialize` guards against double-build.
5. **`EdotCentralConfigMetricExporter` must wrap every metric exporter** — apm-agent-ios v2.0.0 does not honor `recording: Bool` for metrics. Removing this gate re-introduces the bug where Kibana central config "stop recording" silently fails on metrics.
6. **`OTEL_RESOURCE_ATTRIBUTES` double-sets `deployment.environment` and `deployment.environment.name`** — apm-agent-ios hardcodes `deployment.environment.name="default"`. APM Server 8.16+ maps the new key to `service.environment`; legacy key is needed for older versions. (`EdotReactNativeAgent.swift:113-119`)
7. **`X-Edot-RN-Traced` dedup header check** in `URLSessionInstrumentation.shouldInstrument` — without it, every JS-originated `fetch`/`XHR` would be double-spanned (once in JS, once natively). (`EdotReactNative.swift:584-614`)
8. **`reassigning grpcResources is forbidden** — see rule 4. The doc comment above `grpcResources` documents the correct shutdown sequence (`channel.close().wait()` then `group.syncShutdownGracefully()`) for any future teardown path.

## Distribution

`EdotReactNative.podspec` (one level up at `packages/react-native/EdotReactNative.podspec`):
- Compiles `ios/**/*.{swift,h,m}` (Swift uses the pod's own module — no bridging header needed).
- Calls `spm_dependency` for `apm-agent-ios >=2.0.0` (`ElasticApm`) and `opentelemetry-swift >=2.2.1` (`URLSessionInstrumentation`, `OpenTelemetryProtocolExporter`, `OpenTelemetryProtocolExporterHTTP`, `PersistenceExporter`) when the helper is in scope (RN 0.75+).
- Sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` on the pod target only.

Example apps' `project.pbxproj` carries **no** SPM refs, EDOT source files, bridging-header settings, or app-level `ELASTIC_APM_AVAILABLE` — `pod install` wires everything onto the pod target.

## Conventions

- All exporter classes implement `MetricExporter` directly and delegate `flush`/`shutdown`/`getAggregationTemporality`/`getDefaultAggregation` to `inner`.
- File-scope `private static let log = OSLog(subsystem: "co.elastic.edot", category: "metrics")` — reuse via `os_log(... log: log, ...)`. Don't create new `OSLog` instances per call.
- `print()` is forbidden — use `os_log` at the appropriate level.
- Force unwraps (`!`), force casts (`as!`), force tries (`try!`) are forbidden. Use `guard let` / `if let` / `try?`.

## Anti-Patterns

- **Don't use `OpenTelemetry.instance.meterProvider`** — it's resource-less. Use `EdotMeterProviderFactory.build(...)` and store the returned provider on `EdotReactNative.meterProvider`.
- **Don't add metric instruments to `apm-agent-ios`'s global meter provider** — same reason as above.
- **Don't relax the `assert(grpcResources == nil)` tripwire** — convert to a real teardown if SDK reinit is ever needed (recipe is in the doc comment above `grpcResources`).
- **Don't skip the `#if ELASTIC_APM_AVAILABLE` guard** on new files in this directory — they will break consumers without SPM resolution.
