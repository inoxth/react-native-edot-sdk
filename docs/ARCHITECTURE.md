# Architecture

High-level overview of the EDOT React Native SDK. For user-facing setup see [README.md](../README.md); for contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md); for capability-level specs see [openspec/specs/](../openspec/specs/); for package-level detail see each `packages/*/AGENTS.md`.

## Purpose

`@inox/react-native-edot-sdk` wraps the native EDOT iOS and Android agents (Elastic Distribution of OpenTelemetry) behind a unified JavaScript/TypeScript API. It provides auto-instrumentation (network, errors, lifecycle, startup, navigation, user actions) and manual OTel-style instrumentation (tracer, meter, logger), and emits OTLP-compliant telemetry to an Elastic APM Server or any OTLP-compatible backend.

## Goals

- Drop-in observability for React Native 0.72+ on both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric).
- Feature parity with the DataDog React Native RUM SDK, so existing adopters can migrate.
- OpenTelemetry semantic conventions for spans, metrics, and logs — HTTP attributes follow OTel v1.23 (`http.request.method`, `url.full`, `http.response.status_code`, etc.).
- Delegate native telemetry collection entirely to EDOT iOS and EDOT Android; do not re-implement collection.

## Non-goals

- WebView tracking.
- React Native < 0.72.
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
│  │  • AppState lifecycle       • EdotReactNative.log              │  │
│  │  • Cold-start tracing       • useEdotAction / withEdotTracking │  │
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

Yarn 4 workspace monorepo. Seven library packages under `packages/` and four demo apps under `example/`.

| Package | Purpose |
|---|---|
| `@inox/react-native-edot-sdk` | Core SDK — config, native bridge, auto-instrumentation, public API, React components. |
| `@inox/react-native-edot-shared` | Shared cross-package state (`ActiveViewContext` singleton). Pure JS/TS — no React Native dependency. |
| `@inox/react-native-edot-navigation` | React Navigation view-span integration. |
| `@inox/react-native-edot-expo-router` | Expo Router view-span integration. |
| `@inox/react-native-edot-wix-navigation` | Wix react-native-navigation view-span integration. |
| `@inox/react-native-edot-tracer-provider` | Manual OTel-style tracing and metrics API. |
| `@inox/react-native-edot-cli` | Source-map upload CLI for server-side symbolication. |

## Dependency Graph

```
shared (pure JS/TS, no deps)
  │
  ▼
react-native (core SDK; depends on shared)
  │
  ├── react-native-navigation       (depends on sdk + shared)
  ├── react-native-expo-router      (depends on sdk + shared)
  ├── react-native-wix-navigation   (depends on sdk + shared)
  └── react-native-tracer-provider  (depends on sdk)

cli (standalone Node.js; depends only on commander)
```

Navigation plugins and the tracer-provider load the native module through the subpath export `@inox/react-native-edot-sdk/nativeModule` via a lazy `require(...)` to avoid circular imports at module-evaluation time.

## Native Bridge Model

`EdotNativeModule` in `packages/react-native/src/nativeModule.ts` is the only gateway to native code. It loads in this order:

1. If `global.__turboModuleProxy` is defined, load the TurboModule via `NativeEdotReactNative.ts` (codegen spec).
2. Otherwise fall back to `NativeModules.EdotReactNative` (Old Bridge).
3. Otherwise return a no-op `Proxy` that warns once and makes every call return a safe default (`startSpan` returns `''`, `getCurrentSessionId` returns `''`, everything else is a no-op). This keeps the SDK importable in unit tests and on unsupported platforms.

Spans use a JS-side string ID — `startSpan()` is a synchronous blocking call that returns a UUID, and the native side holds the actual OTel span in a thread-safe registry keyed by that ID. Subsequent `setSpanAttribute*`, `recordSpanException`, and `endSpan` calls reference the ID.

Numeric attributes cross the bridge through the typed `setSpanAttributeNumber` method; booleans through `setSpanAttributeBoolean`. The native side discriminates int vs. double at bridge time (iOS `CFNumberIsFloatType`; Android `isIntegerValued`) so OTel attribute types stay faithful end-to-end.

## Platform Implementations

### iOS (`packages/react-native/ios/`)

Swift, gated by `#if ELASTIC_APM_AVAILABLE`. Two entry points:

- **`EdotReactNative.swift`** — the RN TurboModule. Calls `ElasticApmAgent.start(...)` unless `EdotReactNativeAgent.isPreInitialized` is true.
- **`EdotReactNativeAgent.swift`** — optional pre-init for AppDelegate, before the JS bridge loads. Enforces resource-identity validation (`serviceName`, `serviceVersion`, `deploymentEnvironment` must be non-blank and must not contain `,` or `=`) and injects them into the OTel `Resource` via `OTEL_RESOURCE_ATTRIBUTES` before starting the agent.

Source files are included directly in example app Xcode targets (not as a Pod) because `ElasticApm` is distributed via Swift Package Manager and CocoaPods cannot declare SPM dependencies.

### Android (`packages/react-native/android/`)

Kotlin. Two entry points:

- **`EdotReactNativeModule.kt`** — the RN module. On `initialize(config)`, if not pre-initialized, calls `EdotReactNativeAgent.buildFromJsConfig(...)` to start the agent programmatically from JS config.
- **`EdotReactNativeAgent.kt`** — builds `ElasticApmAgent` via the EDOT Android builder. Applies `exportProtocol` (http/grpc), `sessionSamplingRate`, `diskBufferingEnabled`, service identity, and auth (secret token or API key).

`getCurrentSessionId()` returns `""` — ElasticApmAgent 1.5.0 exposes `SessionManager` only as an internal `$agent_sdk` API. Re-enable once upstream adds a public accessor.

The EDOT Gradle plugin (`co.elastic.otel.android.agent` v1.5.0) must be applied by consumers; it brings the `co.elastic.otel.android` runtime onto the classpath. Requires Gradle 8.7+, AGP 8.9.1+, compileSdk 36, minSdk 24.

## Active View Correlation

`ActiveViewContext` is a pure-JS singleton in `@inox/react-native-edot-shared`. Navigation plugins write to it on screen changes (`setActiveView({ name, spanId })`); auto-instrumentation modules read from it to correlate network and error spans to the current view via `view.name` / `view.id` attributes. The main SDK re-exports the singleton at the subpath `@inox/react-native-edot-sdk/active-view-context` for backwards-compat; navigation plugins import from `@inox/react-native-edot-shared` directly to keep the shared state in one canonical location.

## Where Capability Detail Lives

| Concern | Reference |
|---|---|
| Public API exports | [`packages/react-native/src/index.ts`](../packages/react-native/src/index.ts) |
| Config shape | [`packages/react-native/src/types.ts`](../packages/react-native/src/types.ts), `defaults.ts`, `config.ts` |
| Native method signatures | [`packages/react-native/src/NativeEdotReactNative.ts`](../packages/react-native/src/NativeEdotReactNative.ts) |
| Per-capability specs | [`openspec/specs/`](../openspec/specs/) (fetch instrumentation, error tracking, startup tracing, etc.) |
| Per-package architecture | `packages/*/AGENTS.md` |
| Per-example integration notes | [`example/AGENTS.md`](../example/AGENTS.md) |
