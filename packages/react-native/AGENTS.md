# AGENTS.md — @inox/react-native-edot-sdk

## Overview

Core EDOT React Native SDK. Config validation, native bridge (TurboModule + NativeModules + no-op fallback), auto-instrumentation (fetch, XHR, errors, startup, span cleanup), public API, and React components. Lifecycle events are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec — not by JS.

## Structure

```
src/
├── index.ts                    # Public exports
├── EdotReactNative.ts          # Main SDK — initialize(), setUser(), log(), etc.
├── nativeModule.ts             # Native bridge with TurboModule-first fallback
├── NativeEdotReactNative.ts    # TurboModule spec (codegen interface)
├── config.ts                   # Config validation (throws on invalid)
├── types.ts                    # EdotConfig, EdotUser, platform config types
├── defaults.ts                 # EDOT_DEFAULTS for instrumentation toggles
├── activeViewContext.ts        # Re-export from @inox/react-native-edot-shared
├── instrumentation/
│   ├── fetch.ts                # fetch() monkey-patch with span creation
│   ├── xhr.ts                  # XMLHttpRequest monkey-patch
│   ├── errors.ts               # Global error + promise rejection handlers
│   ├── startup.ts              # Cold/warm start tracing
│   ├── spanCleanup.ts          # Span lifecycle management
│   ├── traceContext.ts         # W3C traceparent generation
│   ├── graphql.ts              # GraphQL operation name extraction
│   └── urlUtils.ts             # URL parsing, sanitization, filtering
├── components/
│   └── EdotErrorBoundary.tsx   # React error boundary
└── interactions/
    ├── use-edot-action.ts      # useEdotAction() hook
    └── with-edot-tracking.tsx  # withEdotTracking() HOC
ios/                            # Native iOS sources (Swift + Obj-C bridge .m)
android/                        # Native Android module (Kotlin)
├── build.gradle.kts            # arch-conditional sourceSet selection
└── src/
    ├── main/java/...           # EdotReactNativeModuleImpl.kt (shared logic) + Package
    ├── oldarch/java/...        # ReactContextBaseJavaModule subclass (Old Arch)
    └── newarch/java/...        # NativeEdotReactNativeSpec subclass (New Arch)
EdotReactNative.podspec         # Real podspec — compiles iOS sources, declares SPM via spm_dependency
react-native.config.js          # Pod / Gradle autolinking hints
```

## Subpath Exports

This package exposes subpath imports used by sibling packages:
- `@inox/react-native-edot-sdk/nativeModule` — `EdotNativeModule` bridge
- `@inox/react-native-edot-sdk/active-view-context` — `ActiveViewContext` re-export

## Key Patterns

### Initialization Flow

`EdotReactNative.initialize(config)`:
1. Validates config (required fields, resource-identity chars, token mutual exclusivity, sampling range) → 2. Flattens platform overrides onto the native payload → 3. Calls native `initialize()` → 4. Sets up JS instrumentation (fetch, XHR, errors, startup) based on `EDOT_DEFAULTS`-merged toggles, plus unconditional `setupSpanCleanup` → 5. Stores teardown functions; `_resetForTesting()` drains them.

On iOS, `EdotReactNativeAgent.preInitialize(...)` (from `ios/EdotReactNativeAgent.swift`) can be called from AppDelegate before the JS bridge loads. It enforces the same resource-identity rules as JS `validateConfig` and injects `service.name`/`service.version`/`deployment.environment` into the OTel `Resource` via `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. If `isPreInitialized`, the JS-side `initialize()` skips `ElasticApmAgent.start` and only records config for the bridge.

### Instrumentation Pattern

Each `setup*()` function in `instrumentation/` monkey-patches a global (fetch, XHR, ErrorUtils) and returns a `() => void` teardown that restores the original. `startup.ts` uses `requestIdleCallback` (not `InteractionManager`) to mark first-render. Startup emits a `cold` parent span with two child spans (`js_bundle_load` and `first_render`) and closes all three via `requestIdleCallback`.

### Typed Span-Attribute Bridge

The native spec (`NativeEdotReactNative.ts`) exposes three typed setters: `setSpanAttribute` (string), `setSpanAttributeNumber` (number), `setSpanAttributeBoolean` (boolean). JS instrumentation uses the number variant for HTTP body sizes, status codes, and startup timings so the native side can pick int vs. double (iOS uses `CFNumberIsFloatType`; Android uses `isIntegerValued`). Never pre-stringify a numeric attribute before handing it to the bridge.

### Native Module Loading

`nativeModule.ts` fallback chain:
1. Check `global.__turboModuleProxy` → load TurboModule via `NativeEdotReactNative.ts`
2. Fall back to `NativeModules.EdotReactNative` (old bridge)
3. Return no-op Proxy (all calls silently succeed — `startSpan()` returns `''`)

#### Native Module Wrapper (startSpan / startClientSpan Proxy)

The exported `EdotNativeModule` is a `Proxy` around the loaded native module. It intercepts both `startSpan` and `startClientSpan` to avoid passing `null`/`undefined` `parentSpanId` values across the RCTBridge (RCTBridge serializes JS `null` as `NSNull`, which cannot be converted to `NSString`). When `parentSpanId` is nullish, the wrapper calls the 2-arg overload; otherwise it passes all 3 args.

`startSpan` creates `kind=INTERNAL` spans (used by errors, startup, view, action, custom JS-driven spans). `startClientSpan` creates `kind=CLIENT` spans and is used by `fetch.ts` / `xhr.ts` so HTTP spans match what apm-agent-ios's native `URLSessionInstrumentation` emits.

**Critical:** The wrapper must use `Proxy` + `Reflect.get()` — never object spread (`{...module, startSpan() {...}}`). TurboModule instances store methods on the prototype, not as own properties. Object spread silently drops them, causing runtime errors like `EdotNativeModule missing expected methods: endSpan`. The test suite includes a `preserves all Spec methods from prototype-based TurboModule instances` case that guards against this regression.

### Resource Attributes

Resource attributes (`service.name`, `service.version`, `os.*`, `device.id`, `process.runtime.*`, `telemetry.sdk.*`, etc.) are auto-injected by apm-agent-ios's `AgentResource` and OpenTelemetry-Swift's `SDKResourceExtension` when `ElasticApmAgent.start(...)` runs. JS supplies service identity (`serviceName`, `serviceVersion`, `deploymentEnvironment`) via `OTEL_RESOURCE_ATTRIBUTES` env var (set in `EdotReactNativeAgent.swift` before agent start). No JS-side resource detection — see `ios/AGENTS.md`.

### iOS Metrics Pipeline

The iOS module replaces apm-agent-ios's global `MeterProvider` with a resource-aware one (`EdotMeterProviderFactory`). Pipeline: `PeriodicMetricReader (60s) → Logging? → Persistence (Caches/elastic/) → CentralConfigGate → HTTP|gRPC`. Default transport gRPC; `exportProtocol: "http"` overrides. `EdotAppMetrics` (MetricKit `application.launch.time`) and `EdotSystemMetrics` (CPU/memory observable gauges) replace apm-agent-ios's reimplementations because they emit through the resource-less global. The `CentralConfigGate` (`EdotCentralConfigMetricExporter`) is a deliberate divergence — upstream v2.0.0 doesn't gate metrics on the central-config `recording` flag. See `ios/AGENTS.md` for the full set of load-bearing rules.

### HTTP Span Attribute Convention

`fetch.ts` and `xhr.ts` emit **legacy** HTTP semantic-conv attribute names (`http.method`, `http.url`, `http.status_code`, `http.scheme`, `http.target`, `net.peer.name`, `net.peer.port`, `http.request_body.size`, `http.response_body.size`) — NOT the v1.23 stable names (`http.request.method`, `url.full`, `http.response.status_code`, …). This matches:

1. The Elastic mobile attributes spec (`https://github.com/elastic/apm/blob/main/specs/agents/mobile/README.md`) — which documents legacy names as the "OTel Convention" agents should send; APM Server remaps to ECS field names internally.
2. apm-agent-ios v2.0.0 via opentelemetry-swift v2.2.1's `URLSessionLogger` (which emits the same legacy names on native HTTP spans).

This alignment lets apm-agent-ios's `ElasticSpanProcessor` recognize JS HTTP spans as HTTP via `isHttpSpan()` (which keys on `http.url` presence) and apply the same enrichment as native: `network.connection.type` via `NetworkStatusInjector`, synthetic-parent transaction wrapping for orphan spans. See `ios/AGENTS.md` "JS-driven HTTP Spans Get Native Enrichment Automatically".

### Configuration Surface (recent additions)

JS-callable config knobs that pass through to apm-agent-ios v2.0.0's builder:
- `disableAgent` — fully suppresses native agent startup
- `persistencePreset: 'default' | 'lowUsage' | 'highVolume'` — tunes `PersistencePerformancePreset`
- `managementUrl` + `remoteManagement` — separate central-config endpoint
- `ios.useOpAMP` — opt-in OpAMP central-config protocol
- `attributeRedactions: { spans, logs }` with `drop` / `dropPattern` / `mask` / `maskPattern` — declarative attribute redaction (Option B; serializes across the bridge)
- `ignoreSpanNames` and `ignoreLogPatterns` — predicate filters via `addSpanFilter` / `addLogFilter`

Validation lives in `config.ts` and throws at `validateConfig` time on invalid input. Native compilation (regex compilation, predicate building) happens in `EdotReactNative.swift:initialize`.

## Native Distribution

### iOS — Self-contained podspec with `spm_dependency`

`apm-agent-ios` (ElasticApm) ships only via Swift Package Manager. React Native 0.75+ exposes a top-level `spm_dependency` Ruby helper (defined in `react_native/scripts/react_native_pods.rb` and applied by `SPMManager` in `cocoapods/spm.rb` during `apply_on_post_install`) that mutates `installer.pods_project` to inject SPM `XCRemoteSwiftPackageReference` + `XCSwiftPackageProductDependency` entries onto the pod target. The SDK uses this directly:

1. **`EdotReactNative.podspec` at the package root** compiles `ios/**/*.{swift,h,m}` as part of the pod target. Swift compiles inside the pod's own module, so no bridging header is needed.
2. **The podspec calls `spm_dependency(s, url: 'https://github.com/elastic/apm-agent-ios.git', requirement: { kind: 'upToNextMajorVersion', minimumVersion: '2.0.0' }, products: ['ElasticApm'])`** when that helper is in scope (RN 0.75+); otherwise it falls back to a pure pod target with no SPM (so non-RN pod consumers still resolve).
3. **`pod_target_xcconfig` sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE`** (and `OTHER_SWIFT_FLAGS = -DELASTIC_APM_AVAILABLE`) on the pod target, so the gate fires only when SPM is actually available.
4. **`install_modules_dependencies(s)`** is called when defined (RN 0.71+) to wire React-Core / new-arch headers; otherwise a plain `s.dependency 'React-Core'` fallback runs.

Each example app's `project.pbxproj` is now free of any `XCRemoteSwiftPackageReference`, `XCSwiftPackageProductDependency`, EDOT source-file references, build-phase entries for EDOT files, `SWIFT_OBJC_BRIDGING_HEADER`, or app-level `ELASTIC_APM_AVAILABLE` — pod install handles all of it.

`EdotReactNative.m` uses `RCT_EXTERN_MODULE(EdotReactNative, NSObject)` + `RCT_EXTERN_METHOD(...)` to expose the Swift methods to the legacy bridge. On New Arch, RN's `RCTLegacyInteropModuleProvider` automatically wraps legacy bridge modules so no `.mm` file or hand-written `getTurboModule:` is needed. The Swift `@objc(initialize:resolve:reject:)` selectors match the codegen-emitted Obj-C protocol shape, so the same Swift class works under both architectures.

**Pod consumer requirement:** RN 0.75+ for `spm_dependency`. The peer dep in `package.json` is `react-native >=0.75.0`. Older consumers can still pod-install the package but the ElasticApm gate stays disabled.

### Android — sourceSet split for New Arch / Old Arch

`build.gradle.kts` reads the `newArchEnabled` Gradle property and adds either `src/newarch/java` or `src/oldarch/java` to the `main` sourceSet. Both directories define the same class name `com.edot.reactnative.EdotReactNativeModule` but extend different base classes:
- Old Arch: `ReactContextBaseJavaModule` with `@ReactMethod` annotations.
- New Arch: codegen-generated `NativeEdotReactNativeSpec` with `override fun`.

All shared logic lives in `EdotReactNativeModuleImpl.kt` under `src/main/java/...` and both module variants delegate to it. `EdotReactNativePackage` extends `BaseReactPackage` (RN 0.74+) and exposes `getReactModuleInfoProvider()` so the same package class works on both architectures. `BuildConfig.IS_NEW_ARCHITECTURE_ENABLED` is generated from the same Gradle property to feed `ReactModuleInfo`.

## Dependencies

- `@inox/react-native-edot-shared` (workspace)
- Peer: `react >=18.0.0`, `react-native >=0.75.0` (required for `spm_dependency`)

## Testing

Jest with `react-native` preset. `moduleNameMapper` resolves `@inox/react-native-edot-shared` to `../shared/src/`.
