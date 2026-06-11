# Plan: Downgrade EDOT agents for iOS 15.6 + Kotlin 2.1.20

> Decision record: [`docs/adr/0001-downgrade-edot-agents-for-ios-15.6-and-kotlin-2.1.md`](./adr/0001-downgrade-edot-agents-for-ios-15.6-and-kotlin-2.1.md)

## Goal

Support a customer's hard minimums — **iOS 15.6** and **stock RN 0.81 (Kotlin 2.1.20)** — by pinning the native EDOT agents to the newest versions that meet them, and removing the SDK features whose APIs don't exist on those versions. The SDK must **build and run without error** on both platforms. Ships as breaking **0.2.0**.

## Target versions

| | Current | Target | Why |
|---|---|---|---|
| `apm-agent-ios` | 2.x (iOS 16) | **1.2.1** (iOS 13) | newest 1.x supporting iOS 15.6 (iOS-16 bump = 1.3.0) |
| OpenTelemetry-Swift | 2.x (split) | **1.13.0** (unified) | exact dep of agent 1.2.1 |
| `co.elastic.otel.android:agent-sdk` | 1.5.0 (Kotlin 2.3.0) | **1.1.0** (Kotlin 2.1.21) | newest agent on the Kotlin 2.1.x line |
| `io.opentelemetry:opentelemetry-api` | 1.60.1 | **1.51.0** | match agent 1.1.0's bundled OTel-Java |
| iOS podspec `platform` | 16.0 | **15.6** | customer requirement |

## Features removed

| Feature | Platforms | Reason |
|---|---|---|
| `setUser` / `setSessionAttribute` / `setGlobalAttribute` | both | no span-attribute interceptor in iOS 1.2.1 |
| `attributeRedactions` (spans + logs) | both | same missing interceptor on iOS |
| Central config / OpAMP / `managementUrl` / `remoteManagement` | both | absent in iOS 1.2.1 and Android 1.1.0 |
| Custom iOS metrics pipeline (`EdotMeterProviderFactory`, `EdotCentralConfigMetricExporter`, `EdotAppMetrics`, `EdotSystemMetrics`) | iOS | 1.2.1's MeterProvider is already resource-aware; use agent built-ins |
| iOS `withKeepalive` / `withMemoryRebound` | iOS | absent in 1.2.1 |

## Features retained

Traces (`startSpan`/`startClientSpan`/`endSpan`/`setSpanAttribute*`/`recordSpanException`), fetch + XHR auto-instrumentation, JS errors (+ `EdotErrorBoundary`), navigation, startup, logs (`emitLog`), `recordMetric` (via agent global MeterProvider), app/system metrics (from the agent), sessions (`getCurrentSessionId`, `sessionSamplingRate`), `setTrackingConsent` (SDK-internal emission gate — agent-version-independent, verified), `ignoreSpanNames`/`ignoreLogPatterns` (filters survive on both), JS-side URL sanitization, `screen.name`/`screen.id` enrichment (JS-side).

## Implementation checklist

### iOS (`packages/react-native/ios/` + podspec)
- [ ] Podspec: `s.platform = :ios, '15.6'`; repin `apm-agent-ios` to `1.2.1`; replace the OTel-swift **2.x split** declarations with **`opentelemetry-swift` 1.13.0** (unified) and the products it needs (`OpenTelemetryApi`, `OpenTelemetrySdk`, `OpenTelemetryProtocolExporter`/`...HTTP`, `URLSessionInstrumentation`, `PersistenceExporter`).
- [ ] `EdotReactNativeAgent.swift` / `EdotReactNative.swift`: rename `withExportUrl` → `withServerUrl`; remove `useOpAMP`/`withManagementUrl`/`withRemoteManagement`/`withKeepalive`/`withMemoryRebound`; remove `addSpanAttributeInterceptor` + `addLogRecordAttributeInterceptor` (and the user/session/global merge helper + redaction); remove the central-config sample-rate observer. Verify `ElasticApmAgent.start(...)` + `InstrumentationConfiguration` signatures against 1.2.1.
- [ ] Delete the custom metrics pipeline files; route `recordMetric` through `OpenTelemetry.instance.meterProvider` (resource-aware in 1.2.1).
- [ ] Migrate remaining OTel-swift API calls (tracer/spanBuilder, log emit, counters) to 1.13.0.

### Android (`packages/react-native/android/`)
- [ ] `build.gradle.kts`: `agent-sdk` → `1.1.0`; `opentelemetry-api` → `1.51.0`.
- [ ] `EdotReactNativeAgent.kt` / `EdotReactNativeModuleImpl.kt`: remove `setManagementUrl` (2 call sites + `managementUrl` plumbing); remove user/session/global injection + `attributeRedactions` interceptors.
- [ ] Leave `READ_PHONE_STATE` (optional/guarded) — **document** the `tools:node="remove"` opt-out.

### JS / shared (`packages/react-native/src`, `packages/shared/src`)
- [ ] `types.ts`: drop `managementUrl`/`useOpAMP`/`remoteManagement`/`attributeRedactions` config + `setUser`/session/global method types.
- [ ] `config.ts`: drop their validation.
- [ ] `EdotReactNative.ts`, `nativeModule.ts`, `NativeEdotReactNative.ts` (TurboModule spec), `hooks/useEdot.ts`, `shared/getNativeModule.ts`: remove the methods/bridge entries.

### Tests (`packages/react-native/src/__tests__/`)
- [ ] Remove tests for `managementUrl` (config.test), `useOpAMP`/`setUser`/session/global/`attributeRedactions` (EdotReactNative.test), and update `useEdot`/`nativeModule`/`getNativeModule`.
- [ ] Add tests asserting the removed surface is gone and the retained surface still works.
- [ ] Resolve the `.ts`/`.js` duplicate test files (confirm which are sources vs artifacts).

### Docs
- [ ] `README.md` (root + package + `example/basic`): remove API/config docs; iOS min **16 → 15.6**.
- [ ] `AGENTS.md` (root) + `docs/ARCHITECTURE.md`: feature list + iOS min.
- [ ] `packages/react-native/ios/AGENTS.md` ⚠️ **largest rewrite** — drop custom metrics pipeline, `ElasticSpanProcessor` enrichment, central-config gate, OpAMP, span-attribute interceptor sections.
- [ ] `packages/react-native/android/AGENTS.md`: agent 1.1.0, OTel pin, `READ_PHONE_STATE` note.

### Versioning
- [ ] Major **changeset** with a `BREAKING CHANGES` section → **0.2.0**; include the `READ_PHONE_STATE` note.

## Attention points / risks

1. **OTel-Swift 2.x → 1.13.0 is the largest, riskiest item** — metrics/exporter/persistence APIs differ; mitigated by *dropping* the custom pipeline (use agent built-ins).
2. **iOS user-context loss** — `setUser`/session/global no longer enrich spans on iOS (and we drop them on Android too for symmetry). Confirm no dashboards depend on `user.id`/session attrs from this SDK.
3. **Both agents are several releases behind** — no upstream fixes until minimums rise. Note in the ADR/changelog.
4. **Podspec SPM restructure** — the unified 1.x `opentelemetry-swift` package exposes products differently than the 2.x split; example apps must `pod install` cleanly with no SPM ref leakage.

_(Resolved: `setTrackingConsent` was verified to be a fully SDK-internal emission gate with no agent coupling — it is retained unchanged, not a risk.)_

## Build + run validation

Validate on the **4 example apps** + `onebkk-poc`:

- **iOS:** deployment target **15.6**; `pod install` + build; run on an **iOS 15.6 simulator**. Smoke test: agent starts, a manual span + a network request export, no crash.
- **Android:** **RN 0.81 / Kotlin 2.1.20**; `assembleRelease` + run. Same smoke test.
- Optionally add a CI matrix entry (iOS 15.6 sim + Android Kotlin 2.1.20) to keep it enforced.

Definition of done: both platforms **build clean** and the smoke test passes (init → span/log/metric/network export, no crash) with the trimmed feature set.
