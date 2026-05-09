# AGENTS.md — iOS native module

## Overview

iOS half of `@inox/react-native-edot-sdk`. Swift module that bridges JS → `apm-agent-ios` v2.0.0 (via SPM `ElasticApm` product), `opentelemetry-swift-core` v2.3.0 (`OpenTelemetryApi` + `OpenTelemetrySdk`), and `opentelemetry-swift` v2.2.1 (`URLSessionInstrumentation` / `OpenTelemetryProtocolExporter` / `OpenTelemetryProtocolExporterHTTP` / `PersistenceExporter`). All code is gated on `#if ELASTIC_APM_AVAILABLE` — set by the podspec when `spm_dependency` resolves.

## Files

| File                                    | Role                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EdotReactNative.swift`                 | Main RN module. `@objc` bridge methods (`initialize`, `startSpan`, `endSpan`, `setSpanAttribute*`, `recordSpanException`, `recordMetric`, `emitLog`, `setUser`, `setSessionAttribute`, `setGlobalAttribute`, `reportJsException`, `setTrackingConsent`, `getCurrentSessionId`). 657 lines.                                           |
| `EdotReactNative.m`                     | `RCT_EXTERN_MODULE` Obj-C bridge — exposes Swift selectors to legacy bridge; `RCTLegacyInteropModuleProvider` handles New Arch.                                                                                                                                                                                                      |
| `EdotReactNativeAgent.swift`            | Pre-init helper for AppDelegate. Accepts `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol`, `persistencePreset` (mutex + range-validated). Double-sets `deployment.environment` keys in `OTEL_RESOURCE_ATTRIBUTES`, registers the user/session/global span-attribute interceptor, calls `ElasticApmAgent.start(...)`. |
| `EdotMeterProviderFactory.swift`        | Custom `MeterProvider` (replaces upstream global). Pipeline: `PeriodicMetricReader → Logging? → Persistence → CentralConfigGate → HTTP\|gRPC`.                                                                                                                                                                                       |
| `EdotCentralConfigMetricExporter.swift` | Wraps metric exporter; drops batches when `CentralConfig().data.recording == false`.                                                                                                                                                                                                                                                 |
| `EdotAppMetrics.swift`                  | `application.launch.time` histogram via MetricKit (`MXAppLaunchMetric`). Replaces `apm-agent-ios`'s `AppMetrics`.                                                                                                                                                                                                                    |
| `EdotSystemMetrics.swift`               | `system.cpu.usage` + `system.memory.usage` observable gauges via Mach task APIs. Replaces `apm-agent-ios`'s system metrics.                                                                                                                                                                                                          |

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
6. **`OTEL_RESOURCE_ATTRIBUTES` double-sets `deployment.environment` and `deployment.environment.name`** — apm-agent-ios hardcodes `deployment.environment.name="default"`. APM Server 8.16+ maps the new key to `service.environment`; legacy key is needed for older versions. (`EdotReactNativeAgent.swift:164-170`)
7. **`X-Edot-RN-Traced` dedup header check** in `URLSessionInstrumentation.shouldInstrument` — without it, every JS-originated `fetch`/`XHR` would be double-spanned (once in JS, once natively). (`EdotReactNative.swift:584-614`)
8. **`reassigning grpcResources is forbidden** — see rule 4. The doc comment above `grpcResources` documents the correct shutdown sequence (`channel.close().wait()` then `group.syncShutdownGracefully()`) for any future teardown path.

## Distribution

`EdotReactNative.podspec` (one level up at `packages/react-native/EdotReactNative.podspec`):

- Compiles `ios/**/*.{swift,h,m}` (Swift uses the pod's own module — no bridging header needed).
- Calls `spm_dependency` for `apm-agent-ios >=2.0.0` (`ElasticApm`), `opentelemetry-swift-core >=2.3.0` (`OpenTelemetryApi`, `OpenTelemetrySdk`), and `opentelemetry-swift >=2.2.1` (`URLSessionInstrumentation`, `OpenTelemetryProtocolExporter`, `OpenTelemetryProtocolExporterHTTP`, `PersistenceExporter`) when the helper is in scope (RN 0.75+). The `opentelemetry-swift-core` declaration is required because `OpenTelemetryApi` and `OpenTelemetrySdk` are products of that separate package — they do not transitively expose as Swift modules through `opentelemetry-swift` consumers.
- Sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` on the pod target only.

Example apps' `project.pbxproj` carries **no** SPM refs, EDOT source files, bridging-header settings, or app-level `ELASTIC_APM_AVAILABLE` — `pod install` wires everything onto the pod target.

## Conventions

- All exporter classes implement `MetricExporter` directly and delegate `flush`/`shutdown`/`getAggregationTemporality`/`getDefaultAggregation` to `inner`.
- File-scope `private static let log = OSLog(subsystem: "co.elastic.edot", category: "metrics")` — reuse via `os_log(... log: log, ...)`. Don't create new `OSLog` instances per call.
- `print()` is forbidden — use `os_log` at the appropriate level.
- **Every `os_log(...)` call MUST be wrapped in `if EdotReactNative.debugEnabledSnapshot() { ... }`** so log emission is gated by the SDK's runtime `debug` flag. The flag is set from `config.debug` during `initialize` and is read thread-safely via the `static debugEnabledSnapshot()` accessor. Use `[EDOT]` (not `[EDOT-METRICS]` or any subsystem-specific prefix) so all log lines share a single grep target.
- **The `debug` flag has its own dedicated `debugLock` (separate from `stateLock`)**, so `debugEnabledSnapshot()` is safe to call from any code path — including code that already holds `stateLock` (e.g., the os_log gate inside `EdotAppMetrics.init`, which is constructed under `stateLock` in `EdotReactNative.initialize`). **Do not consolidate these locks**; doing so re-introduces the reentrancy deadlock that froze the SDK during the os_log gating rollout (NSLock is not reentrant).
- Force unwraps (`!`), force casts (`as!`), force tries (`try!`) are forbidden. Use `guard let` / `if let` / `try?`.

## JS-driven HTTP Spans Get Native Enrichment Automatically

`fetch.ts` and `xhr.ts` call `EdotNativeModule.startClientSpan(...)` which routes through `tracer.spanBuilder(...).setSpanKind(spanKind: .client).startSpan()`. Because the tracer comes from `OpenTelemetry.instance.tracerProvider`, every JS HTTP span passes through apm-agent-ios's `ElasticSpanProcessor` and picks up the same enrichment as native `URLSession` spans:

- **`type=mobile`** and **`session.id`** — set on every span by the universal attribute interceptor (`ElasticSpanProcessor.swift:67-75`).
- **`network.connection.type` (rich, via `NetworkStatusInjector`)** — set when `isHttpSpan() == true`, which keys on the presence of the `http.url` (legacy) OR `url.full` (v1.23 stable) attribute (`TransactionHelper.swift:19-25`). Our JS spans emit `http.url` per the Elastic mobile spec.
- **Synthetic parent transaction** — created automatically when an HTTP span has `parentSpanId == nil` (which is the default for `startClientSpan(name, attrs, null)`), so JS HTTP calls appear in APM as `transaction → child span` rather than flat root spans (`ElasticSpanProcessor.swift:102-138`).

**Implication:** anyone updating `startClientSpan` or fetch/XHR attributes must keep `http.url` (or `url.full`) in the emitted attribute set, otherwise `isHttpSpan()` returns false and JS HTTP spans silently lose `network.connection.type` and synthetic-parent wrapping.

## User / Session / Global Attribute Injection (`user.id` → ECS `user.id`)

Both `EdotReactNative.initialize` and `EdotReactNativeAgent.preInitialize` register a built-in `ClosureInterceptor<[String: AttributeValue]>` via `configBuilder.addSpanAttributeInterceptor(...)` that delegates to the shared `EdotReactNative.mergeUserSessionGlobalAttributes(_:)` helper. The helper merges `userAttributes` (filtered by `userAttributesSpanScope`), `sessionAttributes`, and `globalAttributes` into every span's attribute set without overwriting explicit keys. `setUser` writes the OTel-stable keys `user.id` / `user.email` / `user.name` (matches ECS field names exactly). The interceptor is the **only** path that puts these onto the synthetic transaction parent that `ElasticSpanProcessor.onEnd` builds for orphan HTTP spans (the agent itself only adds `type=mobile` and `session.id` there). Without it, user attrs land only on child spans and the transaction document has no user context.

Registering the interceptor at both call sites is load-bearing: when the host app pre-initializes via `EdotReactNativeAgent.preInitialize(...)`, JS init never re-builds the agent — so without the pre-init registration, user attrs would silently miss the synthetic-parent enrichment in pre-init flows.

**Order**: this injector is registered **before** the user-supplied `attributeRedactions.spans` interceptor (registered later in `EdotReactNative.initialize`) so consumers can still drop or mask injected values. Don't reorder. See `packages/react-native/AGENTS.md` for the cross-platform pattern.

## Per-Instrumentation Tracer Scope

`startSpan` and `startClientSpan` accept an optional `instrumentationName: NSString?` (4th arg) so each callsite can pass its own tracer scope. The Swift impl resolves it via `tracer(named:)` which falls back to `"react-native-edot"` when nil/empty. Per-callsite scopes (`@inox/react-native-edot-sdk/navigation`, `@inox/react-native-edot-sdk/http`, `@inox/react-native-edot-sdk/startup`, `@inox/react-native-edot-sdk/errors`) appear as `instrumentation.scope.name` on the wire so Kibana can filter by signal type. Native `URLSessionInstrumentation` is configured with a custom `tracer:` parameter so non-JS native HTTP traffic also lands under `@inox/react-native-edot-sdk/http` rather than the upstream library's default `NSURLSession` scope — enabling a single SLO filter to catch both JS-initiated and native HTTP requests. Empty-string `parentSpanId` is treated as no-parent (lookup miss in `activeSpans`). The legacy bridge `.m` declares both methods with `instrumentationName:(NSString * _Nullable)`.

## Native-Only Span Screen Correlation Gap (Deliberate)

JS-controlled spans (fetch/XHR, errors, interactions, manual tracer-provider) carry `screen.name` and `screen.id` via the JS-side `ActiveViewContext` enrichment. Spans started purely from native iOS code — apm-agent-ios's `ApplicationLifecycleInstrumentation` events, `AppMetrics` (responsiveness/hangtime/exits), `CrashReporting`, and any third-party iOS SDK that calls `URLSession` directly — bypass this and **do not** carry `screen.name`.

This is a deliberate gap (design D7 in `openspec/changes/archive/.../align-navigation-with-elastic-mobile-spec/design.md`). opentelemetry-android achieves universal `screen.name` enrichment via `ScreenAttributesSpanProcessor.onStart()` registered globally. The iOS equivalent would require:

1. A new native method `setNativeActiveView({ name, spanId })` plumbed from JS `ActiveViewContext.setActiveView`.
2. A new `EdotScreenAttributesSpanProcessor` registered alongside `ElasticSpanProcessor` on the global tracer provider.
3. Cross-thread synchronization since native lifecycle spans can fire from any thread.

Deferred until a concrete third-party-native-URLSession use case appears. Native lifecycle / AppMetrics / Crash spans don't have meaningful screen-correlation semantics anyway (they span screens by definition).

## Anti-Patterns

- **Don't use `OpenTelemetry.instance.meterProvider`** — it's resource-less. Use `EdotMeterProviderFactory.build(...)` and store the returned provider on `EdotReactNative.meterProvider`.
- **Don't add metric instruments to `apm-agent-ios`'s global meter provider** — same reason as above.
- **Don't relax the `assert(grpcResources == nil)` tripwire** — convert to a real teardown if SDK reinit is ever needed (recipe is in the doc comment above `grpcResources`).
- **Don't skip the `#if ELASTIC_APM_AVAILABLE` guard** on new files in this directory — they will break consumers without SPM resolution.
