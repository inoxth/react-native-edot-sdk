# AGENTS.md — Android native module

## Overview

Android half of `@inoxth/react-native-edot-sdk`. Kotlin module that bridges JS → `apm-agent-android` (EDOT Gradle plugin `co.elastic.otel.android.agent` v1.1.0, runtime `co.elastic.otel.android:agent-sdk:1.1.0`) and `io.opentelemetry:opentelemetry-api:1.51.0`. Pinned to the 1.1.x line so the module compiles under stock RN 0.81 (Kotlin 2.1.20) — `agent-sdk` ≥ 1.2.0 requires Kotlin ≥ 2.2 (see DEV-420). Supports Old Arch (`ReactContextBaseJavaModule` + `@ReactMethod`) and New Arch (codegen-generated `NativeEdotReactNativeSpec`) from a single codebase via arch-conditional source sets.

`apm-agent-android` 1.1.0 does **not** auto-emit `application.launch.time`, `system.cpu.usage`, or `system.memory.usage` — all three are filled in by this module (`EdotAppMetrics.kt`, `EdotSystemMetrics.kt`). Without those classes the metrics never reach APM Server. `getCurrentSessionId()` always returns `""` — `ElasticApmAgent` 1.1.0 exposes `SessionManager` only as an internal `$agent_sdk` API.

## Files

| File | Role |
| --- | --- |
| `src/main/java/.../EdotReactNativeModuleImpl.kt` | Shared bridge logic — all bridge methods (`initialize`, `startSpan`, `startClientSpan`, `endSpan`, `setSpanAttribute*`, `recordSpanException`, `recordMetric`, `emitLog`, `reportJsException`, `setTrackingConsent`, `getCurrentSessionId`, `getTraceparent`). Companion holds `isInitialized`, `debugEnabled`, and `trackingConsent`. `activeSpans` is a synchronized `LinkedHashMap` (LRU, evicts at >512, evicted spans auto-ended). |
| `src/main/java/.../EdotReactNativeAgent.kt` | Agent lifecycle singleton. `preInitialize(...)` for `MainApplication` pre-start. `buildFromJsConfig(...)` for the JS-init path. Holds `agent: ElasticApmAgent?` and exposes `openTelemetry: OpenTelemetry?`. |
| `src/main/java/.../EdotReactNativePackage.kt` | `BaseReactPackage`. `getReactModuleInfoProvider()` feeds `ReactModuleInfo` with `isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED` so the same package class works on both architectures. |
| `src/main/java/.../EdotAppMetrics.kt` | Emits `application.launch.time` histogram (unit `s`, scope `ApplicationMetrics`). Singleton via `install(application, openTelemetry)`. Registers `ActivityLifecycleCallbacks` + posts a `Choreographer` frame callback; `AtomicBoolean recorded` guarantees one sample per process. |
| `src/main/java/.../EdotSystemMetrics.kt` | Observable gauges `system.cpu.usage` (double, `state=app`) and `system.memory.usage` (long, `state=app`). Scopes `CPU Sampler` / `Memory Sampler`, version `1.0.0` (matches iOS). |
| `src/main/java/.../EdotConfigCompilers.kt` | Ports iOS `compileSpanNamePredicates` / `compileLogPredicates`. Builds typed `Interceptor<SpanExporter>` / `Interceptor<LogRecordExporter>` exporter filters for the agent builder. Regex flag mapping: `i`→`CASE_INSENSITIVE`, `m`→`MULTILINE`, `s`→`DOTALL`. |
| `src/newarch/java/.../EdotReactNativeModule.kt` | Extends codegen `NativeEdotReactNativeSpec`. All methods delegate to `EdotReactNativeModuleImpl`. |
| `src/oldarch/java/.../EdotReactNativeModule.kt` | Extends `ReactContextBaseJavaModule`. Same method set with `@ReactMethod`. `startSpan`, `startClientSpan`, `getTraceparent` declare `isBlockingSynchronousMethod = true`. |
| `build.gradle.kts` | `compileSdk 36`, `minSdk 24`, Java/JVM 17. Reads `newArchEnabled` Gradle property to select `src/newarch/java` vs `src/oldarch/java`. Generates `IS_NEW_ARCHITECTURE_ENABLED` `BuildConfig` field. |

## Architecture

### SourceSet split

`build.gradle.kts:31-39` reads `project.findProperty("newArchEnabled") == "true"` and adds either `src/newarch/java` or `src/oldarch/java` to the `main` sourceSet. Both directories define the same FQN `com.edot.reactnative.EdotReactNativeModule`; all logic lives in `EdotReactNativeModuleImpl.kt` under `src/main/java/`.

### Two agent-start paths

- **`EdotReactNativeAgent.preInitialize(...)`** — called from `MainApplication` before the JS bridge loads. Validates identity (`serviceName`, `serviceVersion`, `deploymentEnvironment` non-blank, no `,` or `=`), `secretToken`/`apiKey` mutex, `sessionSamplingRate` ∈ [0, 1]. Idempotent via `preInitialized.compareAndSet(false, true)`. Builds the agent, then installs `EdotAppMetrics` and `EdotSystemMetrics`.
- **`EdotReactNativeAgent.buildFromJsConfig(...)`** — called from `EdotReactNativeModuleImpl.initialize(...)` when not pre-initialized. Accepts the full JS surface including span/log exporter filters. Skipped entirely if `config.disableAgent == true`.

### Interceptor registration order

Only `buildFromJsConfig` registers interceptors, in order: `spanExporterFilter`, `logExporterFilter`. `preInitialize` takes no filter surface and registers none.

### Post-pre-init JS field drop warning

When `EdotReactNativeAgent.isPreInitialized` is true, `EdotReactNativeModuleImpl.warnDroppedJsFieldsAfterPreInit` logs (under `debug`) any of `apiKey`, `sessionSamplingRate`, `exportProtocol`, `diskBufferingEnabled` it received from JS. Those values cannot be applied to a running agent — only `preInitialize` paths can pass them.

### `activeSpans` LRU cap

`Collections.synchronizedMap(LinkedHashMap)` with `removeEldestEntry` returning true when `size > 512`. Evicted entries are auto-ended (`eldest.value.end()`) to prevent leaks if JS never calls `endSpan`.

### No custom `MeterProvider` (contrast iOS)

`apm-agent-android`'s `ElasticApmAgent.getOpenTelemetry()` returns a resource-aware `OpenTelemetry` instance. `EdotAppMetrics` and `EdotSystemMetrics` call `openTelemetry.getMeter(...)` / `openTelemetry.meterBuilder(...)` directly. apm-agent-ios 1.2.1's global meter is likewise resource-aware, so neither platform needs a custom `MeterProvider` — the 2.x-era custom iOS pipeline was removed in the downgrade.

### Export protocol selection

`exportProtocol == "grpc"` → `ExportProtocol.GRPC`. **Anything else (including null) defaults to `ExportProtocol.HTTP`** — note this is opposite to iOS (which defaults to gRPC). The upstream `apm-agent-android` default is HTTP; we follow it.

### Numeric attribute typing

`isIntegerValued(value: Double)` returns true iff `value.isFinite() && value == value.toLong().toDouble()`. Integer-valued doubles are stored as `Long`, fractional as `Double`. Applied at the numeric write sites `setSpanAttributeNumber` and `emitLog` attributes (`recordMetric` attributes are string-only labels — stringified to match iOS). Mirrors iOS's `CFNumberIsFloatType` logic so APM Server stores the right OTel type.

## Load-Bearing Rules

These rules have an observable failure if removed.

1. **`AtomicBoolean recorded` in `EdotAppMetrics.scheduleRecord`** (`EdotAppMetrics.kt:69`) — `scheduleRecord()` is invoked twice: once eagerly in `init` (for the JS-init path where the activity is already resumed) and again on `onActivityResumed`. `compareAndSet(false, true)` guarantees exactly one histogram sample per process even when both fire.
2. **`installed` double-check in `EdotSystemMetrics.install`** (`EdotSystemMetrics.kt:88-93`) — `synchronized(this)` with the null check prevents double-registration of the observable gauges. A duplicate registration would attach a second callback to the same `Meter` and double-count samples.
3. **`preInitialized.compareAndSet(false, true)` in `preInitialize`** (`EdotReactNativeAgent.kt:49`) — host apps may call `preInitialize` twice (e.g. multiple `Application.onCreate` paths in flavored builds); this guard avoids building a second `ElasticApmAgent`.
4. **Explicit `setExplicitBucketBoundariesAdvice` for `application.launch.time`** (`EdotAppMetrics.kt:40, 85-88`) — OTel's default histogram boundaries are tuned for ms-scale HTTP durations. Without this advice, a typical 1–4s cold start collapses into bucket `[0, 5]` and APM Server reports the midpoint (2.5s) regardless of the true value. iOS doesn't hit this because `EdotAppMetrics.swift` already supplies bucket boundaries derived from MetricKit.
5. **`AtomicLong` pair for CPU delta** (`EdotSystemMetrics.kt:44-45, 50-57`) — `lastCpuMs` / `lastWallMs` use `getAndSet` so the gauge callback is thread-safe across SDK metric reader threads. Non-atomic reads would produce incorrect deltas under contention.
6. **`BuildConfig.IS_NEW_ARCHITECTURE_ENABLED` wired into `ReactModuleInfo.isTurboModule`** (`EdotReactNativePackage.kt:26`, `build.gradle.kts:15`) — a wrong value loads the module under the wrong arch pipeline at runtime.
7. **`getCurrentSessionId()` resolves `""` (never throws)** (`EdotReactNativeModuleImpl.kt:197-202`) — `ElasticApmAgent` 1.1.0 exposes no public session accessor. JS callers depend on the promise resolving; rejecting would surface as a noisy app-level error for a benign upstream gap.
8. **`isBlockingSynchronousMethod = true` on `startSpan`, `startClientSpan`, `getTraceparent`** (`src/oldarch/.../EdotReactNativeModule.kt:40, 48, 56`) — these methods return a span ID / traceparent synchronously and JS reads the return value immediately (`fetch.ts` sets `X-Edot-Traceparent` headers before await). Removing the flag makes them async-only under Old Arch and breaks the bridge contract.

## Distribution

`build.gradle.kts`: `compileSdk 36`, `minSdk 24`, Java/JVM 17. Dependencies: `com.facebook.react:react-android`, `io.opentelemetry:opentelemetry-api:1.51.0`, `co.elastic.otel.android:agent-sdk:1.1.0`.

Example apps apply the EDOT Gradle plugin `co.elastic.otel.android.agent` v1.1.0 for build-time code-generation and instrumentation hooks. **The plugin version must match the runtime `agent-sdk` (1.1.0)** — a newer plugin transitively pulls a newer `agent-sdk` (≥ 1.2.0 requires Kotlin ≥ 2.2, which breaks stock RN 0.81 / Kotlin 2.1.20 with an internal compiler error). Requires Gradle 8.7+, AGP 8.9.1+, compileSdk 36. Don't add `co.elastic.otel.android.instrumentation.okhttp` — see Anti-Patterns.

### `READ_PHONE_STATE` permission

`agent-sdk` 1.1.0 declares `READ_PHONE_STATE` in its manifest, which merges into consumer apps. It's a *dangerous* permission used only for an optional cellular network-subtype attribute, and the agent **runtime-guards** it (`NetworkService.getSubtypeName()` checks `isPermissionGranted` before any telephony read — no crash if ungranted). We intentionally do **not** strip it from this library's manifest — the app owns its merged manifest, and a library-side `tools:node="remove"` is non-idiomatic and can conflict with consumers who legitimately need the permission. Consumers who don't want it remove it in their **own** `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" tools:node="remove" />
```
(requires `xmlns:tools="http://schemas.android.com/tools"` on the `<manifest>` element). Removal is crash-safe — the agent simply skips the cellular network-subtype attribute. Elastic removed this permission upstream in `agent-sdk` 1.3.1 (PR #651).

## Conventions

- All debug output via `EdotReactNativeModuleImpl.debugLog(message)` — gated by `@Volatile debugEnabled`, logs to `android.util.Log.d("EDOT", ...)`. Tag is always `"EDOT"`.
- Don't call `android.util.Log.d/e/w` directly. The one exception is the warning emitted in `recordMetric` / `emitLog` for an unsupported attribute type — non-suppressible by design.
- `TrackingConsent` default `GRANTED`. `emissionAllowed()` is the single gate checked before every span/log/metric emission path; new emission code must call it first.

## Anti-Patterns

- **Don't add `co.elastic.otel.android.instrumentation.okhttp`** to consumer apps. RN's `fetch` / `XHR` are already instrumented at the JS layer; the plugin would emit a second span for every JS HTTP call. Android has no `X-Edot-RN-Traced` dedup filter because the plugin isn't active by default (iOS's `URLSessionInstrumentation` filter handles the equivalent concern on that platform).
- **Don't call `buildFromJsConfig` when `isPreInitialized == true`.** `EdotReactNativeModuleImpl.initialize` already guards this; bypassing the guard would build a second `ElasticApmAgent`.
- **Don't use the SDK's default tracer scope (`"react-native-edot"`) inside `EdotAppMetrics` or `EdotSystemMetrics`.** Those classes use their own scopes (`ApplicationMetrics`, `CPU Sampler`, `Memory Sampler`) so cross-platform dashboards can group iOS + Android samples under one `instrumentation.scope.name`.
- **Don't skip `isIntegerValued` when writing numeric attributes.** `setSpanAttributeNumber` and `emitLog` must preserve the int/double distinction so APM Server stores the correct OTel attribute type (`recordMetric` attributes are string-only).
- **Don't partial-init when `disableAgent == true`.** `buildFromJsConfig` must be skipped wholesale; `EdotAppMetrics` / `EdotSystemMetrics` are not installed; `emissionAllowed()` plus the missing `EdotReactNativeAgent.openTelemetry` short-circuits the bridge cleanly. A no-op agent built halfway would still register lifecycle callbacks.
