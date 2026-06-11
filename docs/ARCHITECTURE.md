# Architecture

High-level overview of the React Native EDOT SDK. For user-facing setup see [README.md](../README.md); for contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md); for package-level detail see each `packages/*/AGENTS.md`.

## Purpose

`@inoxth/react-native-edot-sdk` wraps the native EDOT iOS and Android agents (Elastic Distribution of OpenTelemetry) behind a unified JavaScript/TypeScript API. It provides auto-instrumentation (network, errors, startup, navigation, user actions) and manual OTel-style instrumentation (tracer, meter, logger), and emits OTLP-compliant telemetry to an Elastic APM Server or any OTLP-compatible backend. App lifecycle events are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec.

## Goals

- Drop-in observability for React Native 0.75+ on both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric).
- Feature parity with the DataDog React Native RUM SDK, so existing adopters can migrate.
- OpenTelemetry semantic conventions for spans, metrics, and logs. HTTP spans currently use the legacy Elastic mobile attribute names (`http.method`, `http.url`, `http.status_code`, `http.request_body.size`, `http.response_body.size`) for parity with apm-agent-ios / apm-agent-android; migration to OTel v1.23 (`http.request.method`, `url.full`, `http.response.status_code`) is tracked separately.
- Delegate native telemetry collection to EDOT iOS and EDOT Android wherever possible. Apply targeted local patches only when upstream behavior diverges from spec or breaks RN integration — see `packages/react-native/ios/AGENTS.md` for the documented set of iOS divergences.

## Non-goals

- WebView tracking.
- React Native < 0.75 (the iOS podspec relies on the `spm_dependency` helper introduced in RN 0.75).
- Shipping a custom OTLP collector. The SDK exports to an existing APM Server.
- Building a native telemetry pipeline.

## High-level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      React Native Application                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      JavaScript thread                         │  │
│  │                                                                │  │
│  │  Auto-instrumentation       Manual API                         │  │
│  │  • fetch / XHR              • getTracerProvider                │  │
│  │  • JS errors                • getMeterProvider                 │  │
│  │  • Cold-start tracing       • EdotReactNative.log              │  │
│  │  • App-state tracking       • useEdotAction / withEdotTracking │  │
│  │  • Navigation plugins                                          │  │
│  │           │                          │                         │  │
│  │           └────────────┬─────────────┘                         │  │
│  │                        ▼                                       │  │
│  │          EdotNativeModule (TS bridge wrapper)                  │  │
│  │          • TurboModule → NativeModules → no-op Proxy fallback  │  │
│  └────────────────────────┬───────────────────────────────────────┘  │
│                           ▼                                          │
│              ┌────────────────────────┐                              │
│              │  RN bridge / JSI       │                              │
│              └──┬──────────────────┬──┘                              │
│                 ▼                  ▼                                 │
│  ┌──────────────────────┐  ┌─────────────────────────┐               │
│  │ iOS: EdotReactNative │  │ Android: EdotReactNative│               │
│  │   .swift  (Swift)    │  │   Module.kt  (Kotlin)   │               │
│  │ → ElasticApmAgent    │  │ → ElasticApmAgent       │               │
│  │   (EDOT iOS SPM)     │  │   (EDOT Android Gradle) │               │
│  └──────────────────────┘  └─────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  OTLP export (http / grpc)
                           │
                           ▼
               Elastic APM Server / any OTLP backend
```

## Package Map

Yarn 4 workspace monorepo. Five library packages under `packages/` and four demo apps under `example/`.

| Package | Purpose |
|---|---|
| `@inoxth/react-native-edot-sdk` | Core SDK — config, native bridge, auto-instrumentation, public API, React components. |
| `@inoxth/react-native-edot-shared` | Shared cross-package state (`ActiveViewContext` singleton). Pure JS/TS — no React Native dependency. |
| `@inoxth/react-native-edot-navigation` | Unified screen-span integration covering React Navigation, Expo Router, and Wix react-native-navigation. |
| `@inoxth/react-native-edot-tracer-provider` | Manual OTel-style tracing and metrics API. |
| `@inoxth/react-native-edot-cli` | Source-map upload CLI for server-side symbolication. |

## Dependency Graph

```
shared (pure JS/TS, no deps)
  │
  ▼
react-native (core SDK; depends on shared)
  │
  ├── react-native-navigation       (depends on sdk + shared; 3 optional navigator peer deps)
  └── react-native-tracer-provider  (depends on sdk)

cli (standalone Node.js; depends only on commander)
```

The unified navigation package and the tracer-provider load the native module through the subpath export `@inoxth/react-native-edot-sdk/nativeModule` via a lazy `require(...)` to avoid circular imports at module-evaluation time. The three navigator libraries (`@react-navigation/native`, `expo-router`, `react-native-navigation`) are declared as **optional** peer dependencies via `peerDependenciesMeta` and duck-typed via local `…Like` interfaces — never imported at module top level.

## Native Bridge Model

`EdotNativeModule` in `packages/react-native/src/nativeModule.ts` is the only gateway to native code. It loads in this order:

1. If `global.__turboModuleProxy` is defined, load the TurboModule via `NativeEdotReactNative.ts` (codegen spec).
2. Otherwise fall back to `NativeModules.EdotReactNative` (Old Bridge).
3. Otherwise return a no-op `Proxy` that warns once and makes every call return a safe default (`startSpan` returns `''`, `getCurrentSessionId` returns `''`, everything else is a no-op). This keeps the SDK importable in unit tests and on unsupported platforms.

Spans use a JS-side string ID — `startSpan()` is a synchronous blocking call that returns a UUID, and the native side holds the actual OTel span in a thread-safe registry keyed by that ID. Subsequent `setSpanAttribute*`, `recordSpanException`, and `endSpan` calls reference the ID.

Numeric attributes cross the bridge through the typed `setSpanAttributeNumber` method; booleans through `setSpanAttributeBoolean`. The native side discriminates int vs. double at bridge time (iOS `CFNumberIsFloatType`; Android `isIntegerValued`) so OTel attribute types stay faithful end-to-end.

## Platform Implementations

### iOS (`packages/react-native/ios/`)

Swift, gated by `#if ELASTIC_APM_AVAILABLE`. Entry points:

- **`EdotReactNative.swift`** — the RN TurboModule. Calls `ElasticApmAgent.start(...)` unless `EdotReactNativeAgent.isPreInitialized` is true. Disables apm-agent-ios's URLSession swizzle and reinstalls a filtered `URLSessionInstrumentation` keyed off the `X-Edot-RN-Traced` header so JS-driven `fetch`/`XHR` aren't double-spanned.
- **`EdotReactNativeAgent.swift`** — optional pre-init for AppDelegate, before the JS bridge loads. Enforces resource-identity validation (`serviceName`, `serviceVersion`, `deploymentEnvironment` must be non-blank and must not contain `,` or `=`) and double-sets both `deployment.environment` and `deployment.environment.name` in `OTEL_RESOURCE_ATTRIBUTES` to override apm-agent-ios's hardcoded `"default"` for APM Server 8.16+ semantic conventions.
- **Metrics** — no custom pipeline. `recordMetric` uses apm-agent-ios 1.2.1's legacy (resource-aware) global meter, and `application.launch.time` / `system.cpu.usage` / `system.memory.usage` come from the agent's built-in `AppMetrics` / `CPUSampler` / `MemorySampler` (same names + `state=app` as Android), gated by `enableAppMetricInstrumentation` / `enableSystemMetrics`. The 2.x-era `EdotMeterProviderFactory` / `EdotCentralConfigMetricExporter` / `EdotAppMetrics` / `EdotSystemMetrics` were removed in the downgrade.

See `packages/react-native/ios/AGENTS.md` for the full set of load-bearing rules and the upstream issues these workarounds track.

The SDK ships a real podspec (`packages/react-native/EdotReactNative.podspec`) that compiles its iOS sources and declares the `apm-agent-ios` Swift Package as a dependency via React Native's top-level `spm_dependency` helper (RN 0.75+; resolved by `SPMManager#apply_on_post_install` in `react_native/scripts/cocoapods/spm.rb`). `pod install` mutates `installer.pods_project` to add the SPM package reference and link the `ElasticApm` and `OpenTelemetryApi` / `OpenTelemetrySdk` / `URLSessionInstrumentation` products onto the EdotReactNative pod target — no per-app Xcode SPM configuration is required. The pod target sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` so the `#if ELASTIC_APM_AVAILABLE` gate fires only when SPM is actually wired up.

### Android (`packages/react-native/android/`)

Kotlin. Two entry points:

- **`EdotReactNativeModule.kt`** — the RN module. On `initialize(config)`, if not pre-initialized, calls `EdotReactNativeAgent.buildFromJsConfig(...)` to start the agent programmatically from JS config.
- **`EdotReactNativeAgent.kt`** — builds `ElasticApmAgent` via the EDOT Android builder. Applies `exportProtocol` (http/grpc), `sessionSamplingRate`, `diskBufferingEnabled`, service identity, and auth (secret token or API key).

`getCurrentSessionId()` returns `""` — the EDOT Android agent exposes `SessionManager` only as an internal `$agent_sdk` API. Re-enable once upstream adds a public accessor.

The EDOT Gradle plugin (`co.elastic.otel.android.agent` v1.1.0) must be applied by consumers; it brings the `co.elastic.otel.android` runtime onto the classpath. Requires Gradle 8.7+, AGP 8.9.1+, compileSdk 36, minSdk 24.

## Active View Correlation

`ActiveViewContext` is a pure-JS singleton in `@inoxth/react-native-edot-shared`. The unified navigation package writes to it on screen changes (`setActiveView({ name, spanId })`); auto-instrumentation modules read from it to correlate network and error spans to the current screen via `screen.name` / `screen.id` attributes (the `spanId` field of `ActiveView` is exported as the `screen.id` attribute). The main SDK re-exports the singleton at the subpath `@inoxth/react-native-edot-sdk/active-view-context` for backwards-compat; the navigation package imports from `@inoxth/react-native-edot-shared` directly to keep the shared state in one canonical location.

## Where Capability Detail Lives

| Concern | Reference |
|---|---|
| Public API exports | [`packages/react-native/src/index.ts`](../packages/react-native/src/index.ts) |
| Config shape | [`packages/react-native/src/types.ts`](../packages/react-native/src/types.ts), `defaults.ts`, `config.ts` |
| Native method signatures | [`packages/react-native/src/NativeEdotReactNative.ts`](../packages/react-native/src/NativeEdotReactNative.ts) |
| Per-package architecture | `packages/*/AGENTS.md` |
| iOS load-bearing rules and upstream divergences | [`packages/react-native/ios/AGENTS.md`](../packages/react-native/ios/AGENTS.md) |
| Per-example integration notes | [`example/AGENTS.md`](../example/AGENTS.md) |
