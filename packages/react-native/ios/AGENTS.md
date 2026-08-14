# AGENTS.md — iOS native module

## Overview

iOS half of `@inoxth/react-native-edot-sdk`. Swift module that bridges JS → `apm-agent-ios` **1.2.1** (via the SPM `ElasticApm` product) and **OpenTelemetry-Swift 1.13.0** (unified package — `OpenTelemetryApi` / `OpenTelemetrySdk` / `URLSessionInstrumentation`). All code is gated on `#if ELASTIC_APM_AVAILABLE`, set by the podspec when `spm_dependency` resolves. apm-agent-ios is pinned to 1.2.1 — the newest release that still supports **iOS 15.6** (1.3.0+ raise the floor to iOS 16); see [`docs/adr/0001-…`](../../../docs/adr/0001-downgrade-edot-agents-for-ios-15.6-and-kotlin-2.1.md).

## Files

| File | Role |
| --- | --- |
| `EdotReactNative.swift` | Main RN module. `@objc` bridge methods (`initialize`, `startSpan`, `endSpan`, `setSpanAttribute*`, `recordSpanException`, `recordMetric`, `emitLog`, `reportJsException`, `setTrackingConsent`, `getCurrentSessionId`). Installs a filtered `URLSessionInstrumentation`, and wires `enableSystemMetrics` / `enableAppMetricInstrumentation` onto the agent's `InstrumentationConfiguration`. |
| `EdotReactNative.m` | `RCT_EXTERN_MODULE` Obj-C bridge — exposes Swift selectors to the legacy bridge; `RCTLegacyInteropModuleProvider` handles New Arch. |
| `EdotReactNativeAgent.swift` | Pre-init helper for AppDelegate. Accepts `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol` (mutex + range-validated). Double-sets `deployment.environment` keys in `OTEL_RESOURCE_ATTRIBUTES`, calls `ElasticApmAgent.start(...)`. |

## Metrics (apm-agent-ios 1.2.1)

There is **no custom metrics pipeline**. The 2.x-era `EdotMeterProviderFactory` / `EdotCentralConfigMetricExporter` / `EdotAppMetrics` / `EdotSystemMetrics` were removed in the downgrade — they only existed because apm-agent-ios **2.0.0** removed its own `AppMetrics`/samplers and built a resource-less global meter. On 1.2.1:

- **`recordMetric`** routes through `OpenTelemetry.instance.meterProvider.get(...)` using the **legacy** meter API (`createIntCounter` / `createDoubleMeasure`). 1.2.1 registers only the legacy (resource-aware) meter provider — there is no stable one — so the stable `MeterProvider` / `gaugeBuilder` API is a **no-op** here. Legacy meter labels are **string-only**, so metric attributes are stringified (matches Android).
- **App / system metrics come from the agent's built-in instrumentation** — `AppMetrics` → `application.launch.time`, `CPUSampler` → `system.cpu.usage`, `MemorySampler` → `system.memory.usage`, all with `state=app`. They default on; `EdotReactNative.initialize` wires `enableAppMetricInstrumentation` / `enableSystemMetrics` onto the agent's `InstrumentationConfiguration` so the JS toggles gate them. Same metric names as Android — see [`docs/parity-after-downgrade.md`](../../../docs/parity-after-downgrade.md).

## Load-Bearing Rules

These have a documented "why" in source comments. Removing or relaxing one **silently** breaks something.

1. **`#if ELASTIC_APM_AVAILABLE` guard** wraps every file's body. The flag is set by `pod_target_xcconfig` only when `spm_dependency` resolves; calling `ElasticApm` outside the guard breaks builds for consumers without SPM.
2. **`recordMetric` uses the legacy meter** (`OpenTelemetry.instance.meterProvider.get(...)` → `createIntCounter`/`createDoubleMeasure`) — do **not** switch to the stable `MeterProvider`/`gaugeBuilder` API; 1.2.1 registers no stable provider, so the stable route silently emits nothing.
3. **`OTEL_RESOURCE_ATTRIBUTES` double-sets `deployment.environment` and `deployment.environment.name`** — apm-agent-ios hardcodes `deployment.environment.name="default"`. APM Server 8.16+ maps the new key to `service.environment`; the legacy key is kept for older versions. (`EdotReactNativeAgent.swift`)
4. **`endSpan`'s `statusUnset` (`-1`) branch** — ends the span without assigning `otelSpan.status`. Every other value falls through to `2 → .error` / else `.ok`. Removing it makes a statusless span `Ok`, which suppresses the intake fallback that derives `event.outcome` from `http.status_code`, so a 5xx HTTP exit span would report success ([ADR-0004](../../../docs/adr/0004-mint-a-request-transaction-for-every-traced-request.md)). Mirrored in `EdotReactNativeModuleImpl.kt`.
5. **`X-Edot-RN-Traced` dedup header check** in `URLSessionInstrumentation.shouldInstrument` — without it, every JS-originated `fetch`/`XHR` would be double-spanned (once in JS, once natively). (`EdotReactNative.swift`)

## Distribution

`EdotReactNative.podspec` (one level up at `packages/react-native/EdotReactNative.podspec`):

- Compiles `ios/**/*.{swift,h,m}` (Swift uses the pod's own module — no bridging header needed).
- Calls `spm_dependency` for `apm-agent-ios` **exact 1.2.1** (`ElasticApm`) and `opentelemetry-swift` **exact 1.13.0** (`OpenTelemetryApi`, `OpenTelemetrySdk`, `URLSessionInstrumentation`) when the helper is in scope (RN 0.75+). 1.13.0 is the **unified** OpenTelemetry-Swift package — the 2.x split into `opentelemetry-swift-core` + `opentelemetry-swift` does not apply.
- Sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` on the pod target only.

Example apps' `project.pbxproj` carries **no** SPM refs, EDOT source files, bridging-header settings, or app-level `ELASTIC_APM_AVAILABLE` — `pod install` wires everything onto the pod target.

## Conventions

- `print()` is forbidden — use `os_log` at the appropriate level.
- **Every `os_log(...)` call MUST be wrapped in `if EdotReactNative.debugEnabledSnapshot() { ... }`** so emission is gated by the SDK's runtime `debug` flag (set from `config.debug` during `initialize`, read thread-safely via the `static debugEnabledSnapshot()` accessor). Use the `[EDOT]` prefix so all log lines share a single grep target.
- **The `debug` flag has its own dedicated `debugLock` (separate from `stateLock`)** so `debugEnabledSnapshot()` is safe to call from any code path — including code already holding `stateLock`. **Do not consolidate these locks**; NSLock is not reentrant.
- Force unwraps (`!`), force casts (`as!`), force tries (`try!`) are forbidden. Use `guard let` / `if let` / `try?`.

## JS-driven HTTP Spans Get Native Enrichment Automatically

`fetch.ts` and `xhr.ts` call `EdotNativeModule.startClientSpan(...)` which routes through `tracer.spanBuilder(...).setSpanKind(spanKind: .client).startSpan()`. Because the tracer comes from `OpenTelemetry.instance.tracerProvider`, every JS HTTP span passes through apm-agent-ios's `ElasticSpanProcessor` and picks up the same enrichment as native `URLSession` spans:

- **`type=mobile`** and **`session.id`** — set on every span by the universal attribute interceptor (`ElasticSpanProcessor.swift`).
- **`network.connection.type` (rich, via `NetworkStatusInjector`)** — set when `isHttpSpan() == true`, which keys on the presence of the `http.url` (legacy) OR `url.full` (v1.23 stable) attribute. Our JS spans emit `http.url` per the Elastic mobile spec.
- **Synthetic parent transaction** — created automatically when an HTTP span has `parentSpanId == nil`. **Dormant since DEV-1232**: `fetch.ts` / `xhr.ts` now mint the Request Transaction themselves (`startRequestTransaction` in `instrumentation/httpSpans.ts`) and pass it as `parentSpanId`, so the request span is never parentless and this path never fires. It existed only on iOS, which is why Android had no service-map edge — see [ADR-0004](../../../docs/adr/0004-mint-a-request-transaction-for-every-traced-request.md).

**Implication:** anyone updating `startClientSpan` or fetch/XHR attributes must keep `http.url` (or `url.full`) on the **request** span, otherwise `isHttpSpan()` returns false and JS HTTP spans silently lose `network.connection.type`. Conversely, never put `http.url` on the **Request Transaction** — that revives the synthetic-parent path and produces a third span per request. The Request Transaction is a deliberate copy of what this processor manufactures (same name, `kind=client`, no attributes of its own), so a change to either should be checked against the other.

## Per-Instrumentation Tracer Scope

`startSpan` and `startClientSpan` accept an optional `instrumentationName: NSString?` (4th arg) so each callsite can pass its own tracer scope. The Swift impl resolves it via `tracer(named:)` which falls back to `"react-native-edot"` when nil/empty. Per-callsite scopes (`@inoxth/react-native-edot-sdk/navigation`, `@inoxth/react-native-edot-sdk/http`, `@inoxth/react-native-edot-sdk/startup`, `@inoxth/react-native-edot-sdk/errors`) appear as `instrumentation.scope.name` on the wire so Kibana can filter by signal type. Native `URLSessionInstrumentation` is configured with a custom `tracer:` parameter so non-JS native HTTP traffic also lands under `@inoxth/react-native-edot-sdk/http` rather than the upstream library's default `NSURLSession` scope — enabling a single SLO filter to catch both JS-initiated and native HTTP requests. Empty-string `parentSpanId` is treated as no-parent (lookup miss in `activeSpans`). The legacy bridge `.m` declares both methods with `instrumentationName:(NSString * _Nullable)`.

## Native-Only Span Screen Correlation Gap (Deliberate)

JS-controlled spans (fetch/XHR, errors, interactions, manual tracer-provider) carry `screen.name` and `screen.id` via the JS-side `ActiveViewContext` enrichment. Spans started purely from native iOS code — apm-agent-ios's `ApplicationLifecycleInstrumentation` events, `AppMetrics` (responsiveness/hangtime/exits), `CrashReporting`, and any third-party iOS SDK that calls `URLSession` directly — bypass this and **do not** carry `screen.name`.

This is a deliberate design gap. opentelemetry-android achieves universal `screen.name` enrichment via `ScreenAttributesSpanProcessor.onStart()` registered globally. The iOS equivalent would require:

1. A new native method `setNativeActiveView({ name, spanId })` plumbed from JS `ActiveViewContext.setActiveView`.
2. A new `EdotScreenAttributesSpanProcessor` registered alongside `ElasticSpanProcessor` on the global tracer provider.
3. Cross-thread synchronization since native lifecycle spans can fire from any thread.

Deferred until a concrete third-party-native-URLSession use case appears. Native lifecycle / AppMetrics / Crash spans don't have meaningful screen-correlation semantics anyway (they span screens by definition).

## Anti-Patterns

- **Don't switch `recordMetric` to the stable meter API** (`gaugeBuilder` / `StableMeterProvider`) — 1.2.1 registers no stable meter provider, so it silently drops metrics. Use the legacy `OpenTelemetry.instance.meterProvider.get(...)`.
- **Don't re-add a custom iOS metrics pipeline or `EdotSystemMetrics`** — apm-agent-ios 1.2.1's built-in `AppMetrics` / `CPUSampler` / `MemorySampler` already emit `application.launch.time` / `system.cpu.usage` / `system.memory.usage` (same names as Android); re-adding double-emits (see DEV-428 / DEV-430).
- **Don't skip the `#if ELASTIC_APM_AVAILABLE` guard** on new files in this directory — they will break consumers without SPM resolution.
