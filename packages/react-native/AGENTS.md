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
├── globals.d.ts                # Ambient typings for global / ErrorUtils / requestIdleCallback
├── instrumentation/
│   ├── app-state.ts            # AppState listener — ends screen-lifetime span on background, re-emits on foreground
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

`EdotReactNativeAgent.preInitialize(...)` runs before the JS bridge loads — iOS calls it from AppDelegate (`ios/EdotReactNativeAgent.swift`), Android from `MainApplication` (`android/.../EdotReactNativeAgent.kt`). Both enforce the same resource-identity rules as JS `validateConfig` (no `,` or `=`, `secretToken`/`apiKey` mutex, `sessionSamplingRate` ∈ [0, 1]) and accept the optional surface that affects the agent at start time: `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol`, plus `persistencePreset` (iOS) / `diskBufferingEnabled` (Android). iOS injects identity into `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. Both also register the user/session/global span-attribute interceptor at this point so its enrichment reaches every span — including the synthetic transaction parent that `ElasticSpanProcessor.onEnd` builds for orphan HTTP spans on iOS — even when the host app pre-initializes. If `isPreInitialized`, JS `initialize()` skips agent start and logs (under `debug`) any reserved fields it received that pre-init should have owned, since they cannot be applied to a running agent.

#### Per-platform service identity

`EdotConfig.serviceName` is optional at the type level. The effective value for the running platform is resolved by `resolveResourceField(config, 'serviceName')` in `config.ts`: it returns `config.ios.serviceName` (resp. `config.android.serviceName`) when present, otherwise falls back to the top-level `config.serviceName`. `validateConfig` uses the resolved value for both the required-field check and the `,`/`=` character check. `mergeConfig` passes the resolved value as the single flat `serviceName` key on the bridge payload — native code (Swift / Kotlin) is unchanged and reads `config["serviceName"]` from a flat dict.

```ts
// Distinct services in the APM service map per platform:
EdotReactNative.initialize({
  serverUrl: 'https://apm.example.com:8200',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
  ios: { serviceName: 'myapp-ios' },
  android: { serviceName: 'myapp-android' },
});

// Or with a top-level fallback and one platform-specific override:
EdotReactNative.initialize({
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'myapp',
  ios: { serviceName: 'myapp-ios-special' },
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
});
```

When iOS pre-init is in use, the `serviceName` passed to `EdotReactNativeAgent.preInitialize(...)` from AppDelegate must match what JS `config.ios.serviceName ?? config.serviceName` resolves to — the native agent does not restart on the JS init call once pre-initialized, so a mismatch would silently disagree with the `OTEL_RESOURCE_ATTRIBUTES` env var.

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

The exported `EdotNativeModule` is a `Proxy` around the loaded native module. It intercepts both `startSpan` and `startClientSpan` to avoid passing `null`/`undefined` `parentSpanId` values across the RCTBridge (RCTBridge serializes JS `null` as `NSNull`, which cannot be converted to `NSString`). When `parentSpanId` and `instrumentationName` are both nullish, the wrapper calls the 2-arg overload. When only `parentSpanId` is provided, 3-arg overload. When `instrumentationName` is provided, the wrapper passes `parentSpanId ?? ''` for absent parent (native treats unknown/empty parent as no-parent via the registry lookup miss path) plus `instrumentationName` as a 4th arg.

Both `startSpan` and `startClientSpan` accept an optional `instrumentationName: string | null` 4th parameter. Default `"react-native-edot"` when omitted. Per-callsite scopes:

| Callsite                                                                 | Scope                                 |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `<EdotNavigationProvider>` (react-navigation + expo-router; unified pkg) | `@inox/react-native-edot-navigation`  |
| `registerEdotNavigationListener` (Wix; unified pkg)                      | `@inox/react-native-edot-navigation`  |
| `instrumentation/fetch.ts`                                               | `@inox/react-native-edot-sdk/fetch`   |
| `instrumentation/xhr.ts`                                                 | `@inox/react-native-edot-sdk/xhr`     |
| `instrumentation/errors.ts`                                              | `@inox/react-native-edot-sdk/errors`  |
| `instrumentation/startup.ts`                                             | `@inox/react-native-edot-sdk/startup` |

`startSpan` creates `kind=INTERNAL` spans (used by errors, startup, view, action, custom JS-driven spans). `startClientSpan` creates `kind=CLIENT` spans and is used by `fetch.ts` / `xhr.ts` so HTTP spans match what apm-agent-ios's native `URLSessionInstrumentation` emits.

**Critical:** The wrapper must use `Proxy` + `Reflect.get()` — never object spread (`{...module, startSpan() {...}}`). TurboModule instances store methods on the prototype, not as own properties. Object spread silently drops them, causing runtime errors like `EdotNativeModule missing expected methods: endSpan`. The test suite includes a `preserves all Spec methods from prototype-based TurboModule instances` case that guards against this regression.

### Resource Attributes

Resource attributes (`service.name`, `service.version`, `os.*`, `device.id`, `process.runtime.*`, `telemetry.sdk.*`, etc.) are auto-injected by apm-agent-ios's `AgentResource` and OpenTelemetry-Swift's `SDKResourceExtension` when `ElasticApmAgent.start(...)` runs. JS supplies service identity (`serviceName`, `serviceVersion`, `deploymentEnvironment`) via `OTEL_RESOURCE_ATTRIBUTES` env var (set in `EdotReactNativeAgent.swift` before agent start). No JS-side resource detection — see `ios/AGENTS.md`.

### iOS Metrics Pipeline

The iOS module replaces apm-agent-ios's global `MeterProvider` with a resource-aware one (`EdotMeterProviderFactory`). Pipeline: `PeriodicMetricReader (60s) → Logging? → Persistence (Caches/elastic/) → CentralConfigGate → HTTP|gRPC`. Default transport gRPC; `exportProtocol: "http"` overrides. `EdotAppMetrics` (MetricKit `application.launch.time`) and `EdotSystemMetrics` (CPU/memory observable gauges) replace apm-agent-ios's reimplementations because they emit through the resource-less global. The `CentralConfigGate` (`EdotCentralConfigMetricExporter`) is a deliberate divergence — upstream v2.0.0 doesn't gate metrics on the central-config `recording` flag. See `ios/AGENTS.md` for the full set of load-bearing rules.

### Android Application Launch Metric

`apm-agent-android` v1.5.0 does **not** auto-emit `application.launch.time` (the upstream release-note item referred to `opentelemetry-android`'s separate `androidx.app.startup` instrumentation, which the EDOT distribution does not pull in). `EdotAppMetrics.kt` fills this gap: at agent build time (`preInitialize` or `buildFromJsConfig`) it registers an `Application.ActivityLifecycleCallbacks` and a `Choreographer` frame callback. On the first frame after agent ready, it records one histogram sample with value `(SystemClock.uptimeMillis() - Process.getStartUptimeMillis()) / 1000.0` and unregisters itself. Single source of truth — `AtomicBoolean` ensures only the first frame counts, even if both the immediate post (for activities already resumed at install) and `onActivityResumed` race. Histogram unit: `s` (seconds), instrumentation scope `ApplicationMetrics` to match iOS.

The histogram uses `setExplicitBucketBoundariesAdvice` with cold-start-appropriate boundaries `[0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0, 5.0, 7.5, 10.0, 15.0, 30.0]` (in seconds). OTel's default histogram boundaries `[0, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000]` are tuned for ms-scale HTTP request durations — without explicit advice, a typical 1–4 s cold start collapses into the first bucket `[0, 5]` and APM Server reports the bucket midpoint (2.5 s) regardless of the true value. iOS doesn't hit this issue because `EdotAppMetrics.swift` already advises bucket boundaries derived from MetricKit's payload.

### Android System Metrics

Mirrors iOS's `EdotSystemMetrics.swift`. `EdotSystemMetrics.kt` registers two observable gauges via the agent's `Meter` and is installed alongside `EdotAppMetrics` from both pre-init and JS-init paths.

- `system.cpu.usage` (double gauge, attribute `state=app`) — percent of wall-clock time the process spent on CPU since the previous metric collection. Computed at each callback as `(Δ Process.getElapsedCpuTime() / Δ SystemClock.elapsedRealtime()) * 100`, with previous-sample state stored in `AtomicLong` to keep the callback thread-safe (the SDK metric reader can invoke it from any thread). Multi-threaded saturation can exceed 100 % (e.g. 400 % on a 4-core device with all threads pinned), matching iOS's per-thread sum semantics.
- `system.memory.usage` (long gauge, attribute `state=app`) — total PSS (proportional set size) of the process in bytes, sampled per callback via `Debug.getMemoryInfo(Debug.MemoryInfo())`. Maps to iOS's `phys_footprint`.

Instrumentation scope names match iOS (`CPU Sampler`, `Memory Sampler`, version `1.0.0`) so cross-platform dashboards filter on the same `instrumentation.scope.name`. `apm-agent-android` v1.5.0 has no equivalent of upstream's `CPUSampler` / `MemorySampler` exposed publicly — without `EdotSystemMetrics.kt` the gauges never reach APM Server on Android.

### App-State Tracking

`instrumentation/app-state.ts` installs one `AppState.addEventListener('change', ...)` listener (gated by `EDOT_DEFAULTS.appStateTracking: true`). On `'background'`: ends the active screen-lifetime span via `EdotNativeModule.endSpan(spanId, 1)` and clears `ActiveViewContext`. On `'inactive'`: no-op. On `'active'` after a real background: invokes `ActiveViewContext.notifyForegroundReEmitters()` so each navigation plugin replays its current screen with `previousScreenName = null` (resulting span omits `last.screen.name`). The handler tracks `wasBackgrounded` internally so a transient `inactive → active` (Face ID resolved) does not trigger re-emit.

### Screen Correlation on Network/Error/Interaction Spans

`fetch.ts`, `xhr.ts`, `errors.ts`, and the interactions HOC/hook read `ActiveViewContext.getActiveView()` at span-start time and stamp `screen.name` and (for fetch/xhr/errors) `screen.id` on the span. Mirrors opentelemetry-android's `ScreenAttributesSpanProcessor` behavior at the JS layer (iOS apm-agent has no equivalent processor). `screen.id` is an RN-specific value-add — Android upstream only emits `screen.name`.

### HTTP Span Attribute Convention

`fetch.ts` and `xhr.ts` emit **legacy** HTTP semantic-conv attribute names (`http.method`, `http.url`, `http.status_code`, `http.scheme`, `http.target`, `net.peer.name`, `net.peer.port`, `http.request_body.size`, `http.response_body.size`) — NOT the v1.23 stable names (`http.request.method`, `url.full`, `http.response.status_code`, …). This matches:

1. The Elastic mobile attributes spec (`https://github.com/elastic/apm/blob/main/specs/agents/mobile/README.md`) — which documents legacy names as the "OTel Convention" agents should send; APM Server remaps to ECS field names internally.
2. apm-agent-ios v2.0.0 via opentelemetry-swift v2.2.1's `URLSessionLogger` (which emits the same legacy names on native HTTP spans).

This alignment lets apm-agent-ios's `ElasticSpanProcessor` recognize JS HTTP spans as HTTP via `isHttpSpan()` (which keys on `http.url` presence) and apply the same enrichment as native: `network.connection.type` via `NetworkStatusInjector`, synthetic-parent transaction wrapping for orphan spans. See `ios/AGENTS.md` "JS-driven HTTP Spans Get Native Enrichment Automatically".

### User / Session / Global Attribute Propagation onto Spans

`setUser`, `setSessionAttribute`, and `setGlobalAttribute` write into static attribute dicts on the native module (Swift `EdotReactNative` static state, Kotlin `EdotReactNativeModuleImpl.Companion`). `setUser({ id, email, name })` writes the OTel-stable keys `user.id` / `user.email` / `user.name` (https://opentelemetry.io/docs/specs/semconv/registry/attributes/user/) — these match the ECS field names exactly so APM Server can land them on top-level `user.*` ECS fields where supported.

Both platforms inject these dicts onto every span via a span-attribute interceptor registered at agent build time:

- **iOS**: `ClosureInterceptor<[String: AttributeValue]>` via `configBuilder.addSpanAttributeInterceptor(...)` — registered in **both** `EdotReactNativeAgent.preInitialize` and `EdotReactNative.initialize`, both calling the shared `EdotReactNative.mergeUserSessionGlobalAttributes(_:)` helper. It runs in apm-agent-ios's `ElasticSpanProcessor` for every `onStart` AND for the synthetic transaction parent that `onEnd` builds for orphan HTTP spans (only `type=mobile` and `session.id` are added by the agent itself there). Without the interceptor, user attrs land only on child HTTP spans and the transaction document carries no user context.
- **Android**: `Interceptor<Attributes>` via `ElasticApmAgent.builder.addSpanAttributesInterceptor(...)` — registered in **both** `EdotReactNativeAgent.preInitialize` and `buildFromJsConfig`, both calling the shared `EdotReactNativeModuleImpl.mergeUserSessionGlobalAttributes(...)` helper. Mirrors the iOS pattern.

The merge does not overwrite explicitly-set span attributes (it only fills missing keys). The user-attribute filter (`userAttributesSpanScope`) is applied inside the merge, so by default only `user.id` ships unless `userAttributesSpanScope: 'all'` is configured.

Registration order matters on iOS: the user-attr injector runs **before** the user-supplied `attributeRedactions.spans` redactor (also registered as a span attribute interceptor) so consumers can still drop or mask values we just injected (`user.email`, etc.). Android currently has no span-attribute redaction surface.

Note: APM Server in fully verbatim OTel ingest mode does not auto-promote OTel attributes to top-level ECS fields — they land under `labels.*` (e.g., `labels.user_id`). Consumers in that mode should add a `traces-apm@custom` ingest pipeline that copies `labels.user_id`/`labels.user_email`/`labels.user_name` to the corresponding ECS fields.

iOS still has a per-span inline merge in `makeSpan` (`:530-539`) for redundancy. Android's `makeSpan` no longer has one — the interceptor is the single source of truth.

### Native UIKit View-Controller Instrumentation

`enableViewControllerInstrumentation` defaults to **false** in the RN SDK (overrides apm-agent-ios's upstream default of `true`). The JS navigation plugins (`@inox/react-native-edot-navigation`, `-expo-router`, `-wix-navigation`) emit route-named view spans; the native `viewDidAppear:` swizzle would compete with them and — on `react-native-screens` — emits spans named `RNSScreen` (the wrapper VC class) because the VC `title` isn't populated when the swizzle fires. Opt-in via JS config (`enableViewControllerInstrumentation: true`) if you want raw UIVC spans.

### Initialization Ordering — Mount Navigation After `initialize()` Resolves

`EdotReactNative.initialize(...)` is async. Until it resolves, `OpenTelemetry.instance.tracerProvider` on iOS is the default no-op provider, so `startSpan` calls succeed but produce spans that never export. The navigation provider emits the initial screen span synchronously on mount — if the navigator is mounted before `initialize()` resolves, the **initial** screen span is silently dropped. Consumers must wait for `initialize()` to resolve before mounting the navigation root. See `packages/react-native-navigation/AGENTS.md` for the pattern and the `example/react-navigation/` `sdkReady` gate.

For Wix consumers: `registerEdotNavigationListener` is called inside `Navigation.events().registerAppLaunchedListener` after `await EdotReactNative.initialize(...)`, before `Navigation.setRoot(...)` — so the home screen's first `componentDidAppear` is captured by the listener but only after the SDK is ready.

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
