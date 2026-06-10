# AGENTS.md — @inoxth/react-native-edot-sdk

## Overview

Core React Native EDOT SDK. Config validation, native bridge (TurboModule + NativeModules + no-op fallback), auto-instrumentation (fetch, XHR, errors, startup, span cleanup), public API, and React components. Lifecycle events are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec — not by JS.

## Structure

```
src/
├── index.ts                    # Public exports
├── EdotReactNative.ts          # Main SDK — initialize(), log(), etc.
├── nativeModule.ts             # Native bridge with TurboModule-first fallback
├── NativeEdotReactNative.ts    # TurboModule spec (codegen interface)
├── config.ts                   # Config validation (throws on invalid)
├── types.ts                    # EdotConfig, platform config types
├── defaults.ts                 # EDOT_DEFAULTS for instrumentation toggles
├── activeViewContext.ts        # Re-export from @inoxth/react-native-edot-shared
├── globals.d.ts                # Ambient typings for global / ErrorUtils / requestIdleCallback
├── instrumentation/
│   ├── app-state.ts            # AppState listener — ends screen-lifetime span on background, re-emits on foreground
│   ├── fetch.ts                # fetch() monkey-patch with span creation
│   ├── xhr.ts                  # XMLHttpRequest monkey-patch
│   ├── errors.ts               # Global error + promise rejection handlers (OTel exception events / Elastic mobile crash events)
│   ├── startup.ts              # Cold/warm start tracing
│   ├── spanCleanup.ts          # Span lifecycle management
│   ├── traceContext.ts         # W3C traceparent generation
│   ├── graphql.ts              # GraphQL operation type + name extraction (OTel-semconv span naming)
│   └── urlUtils.ts             # URL parsing, sanitization, filtering
├── components/
│   └── EdotErrorBoundary.tsx   # React error boundary
├── hooks/
│   └── useEdot.ts              # useEdot(config) — React-friendly init hook (first-wins, returns { ready, error })
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

- `@inoxth/react-native-edot-sdk/nativeModule` — `EdotNativeModule` bridge
- `@inoxth/react-native-edot-sdk/active-view-context` — `ActiveViewContext` re-export

## Key Patterns

### Initialization Flow

`useEdot(config)` from `hooks/useEdot.ts` is the React-friendly entry point — calls `EdotReactNative.initialize` once via `useEffect`, captures config in a ref so subsequent renders never re-init, and returns `{ ready, error }`. First-wins: a `__DEV__` `console.warn` fires when a native-relevant primitive key (`serverUrl`, `serviceName`, `serviceVersion`, `deploymentEnvironment`, `secretToken`, `apiKey`, `exportProtocol`, `sessionSamplingRate`, `trackingConsent`, `managementUrl`, `disableAgent`, `enableAppMetricInstrumentation`, `enableSystemMetrics`, `instrumentNetworkRequests`, `instrumentJsErrors`, `instrumentAppStartup`, `appStateTracking`, `debug`) changes after first render. Object-shaped fields (`ignoreSpanNames`, `ignoreLogPatterns`, `ios`, `android`) are excluded from the compare to avoid identity false-positives. Init failures are passive — `console.warn`'d once, never thrown — so observability degrades silently rather than crashing the app via an `EdotErrorBoundary`. The imperative `EdotReactNative.initialize(config)` remains for non-React contexts.

`EdotReactNative.initialize(config)`:

1. Validates config (required fields, resource-identity chars, token mutual exclusivity, sampling range) → 2. Flattens platform overrides onto the native payload → 3. Calls native `initialize()` → 4. Sets up JS instrumentation (fetch, XHR, errors, startup) based on `EDOT_DEFAULTS`-merged toggles, plus unconditional `setupSpanCleanup` → 5. Stores teardown functions; `_resetForTesting()` drains them.

`EdotReactNativeAgent.preInitialize(...)` runs before the JS bridge loads — iOS calls it from AppDelegate (`ios/EdotReactNativeAgent.swift`), Android from `MainApplication` (`android/.../EdotReactNativeAgent.kt`). Both enforce the same resource-identity rules as JS `validateConfig` (no `,` or `=`, `secretToken`/`apiKey` mutex, `sessionSamplingRate` ∈ [0, 1]) and accept the optional surface that affects the agent at start time: `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol`, plus `persistencePreset` (iOS) / `diskBufferingEnabled` (Android). iOS injects identity into `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. If `isPreInitialized`, JS `initialize()` skips agent start and logs (under `debug`) any reserved fields it received that pre-init should have owned, since they cannot be applied to a running agent.

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

Each `setup*()` function in `instrumentation/` monkey-patches a global (fetch, XHR, ErrorUtils) and returns a `() => void` teardown that restores the original. `startup.ts` uses `requestIdleCallback` (not `InteractionManager`) to mark first-render. Startup emits a `AppStartup: cold` parent span with two child spans (`AppStartup: js_bundle_load` and `AppStartup: first_render`) and closes all three via `requestIdleCallback`.

These JS-side startup span names are RN-specific. EDOT iOS reports app launch as a metric only (`application.launch.time` histogram via MetricKit — see `EdotAppMetrics.swift`) and EDOT Android does not auto-instrument app startup at all (`AppMetrics.kt` fills the gap with a matching histogram). OTel mobile semantic conventions do not yet define startup span names. The `AppStartup:` prefix is therefore not changed to match a non-existent upstream convention; the native `application.launch.time` metric remains the cross-platform comparable signal.

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

| Callsite                                                                 | Scope                                    |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| `<EdotNavigationProvider>` (react-navigation + expo-router; unified pkg) | `@inoxth/react-native-edot-sdk/navigation` |
| `registerEdotNavigationListener` (Wix; unified pkg)                      | `@inoxth/react-native-edot-sdk/navigation` |
| `instrumentation/fetch.ts`                                               | `@inoxth/react-native-edot-sdk/http`       |
| `instrumentation/xhr.ts`                                                 | `@inoxth/react-native-edot-sdk/http`       |
| iOS `URLSessionInstrumentation` (3rd-party native HTTP, WebViews)        | `@inoxth/react-native-edot-sdk/http`       |
| `instrumentation/errors.ts`                                              | `@inoxth/react-native-edot-sdk/errors`     |
| `instrumentation/startup.ts`                                             | `@inoxth/react-native-edot-sdk/startup`    |

All four scopes share the `@inoxth/react-native-edot-sdk/<class>` shape so a single `service.framework.name : "@inoxth/react-native-edot-sdk/<class>"` KQL filter cleanly classifies every emitted span — enabling per-class SLO definitions in Elastic APM (HTTP, navigation, startup, errors) without `transaction.name` regex hacks. Native `URLSession` traffic is rebranded under `.../http` via a custom `tracer` passed to `URLSessionInstrumentationConfiguration` (see `installURLSessionInstrumentation` in `EdotReactNative.swift`).

`startSpan` creates `kind=INTERNAL` spans (used by errors, startup, view, action, custom JS-driven spans). `startClientSpan` creates `kind=CLIENT` spans and is used by `fetch.ts` / `xhr.ts` so HTTP spans match what apm-agent-ios's native `URLSessionInstrumentation` emits.

**Critical:** The wrapper must use `Proxy` + `Reflect.get()` — never object spread (`{...module, startSpan() {...}}`). TurboModule instances store methods on the prototype, not as own properties. Object spread silently drops them, causing runtime errors like `EdotNativeModule missing expected methods: endSpan`. The test suite includes a `preserves all Spec methods from prototype-based TurboModule instances` case that guards against this regression.

### Resource Attributes

Resource attributes (`service.name`, `service.version`, `os.*`, `device.id`, `process.runtime.*`, `telemetry.sdk.*`, etc.) are auto-injected by apm-agent-ios's `AgentResource` and OpenTelemetry-Swift's `SDKResourceExtension` when `ElasticApmAgent.start(...)` runs. JS supplies service identity (`serviceName`, `serviceVersion`, `deploymentEnvironment`) via `OTEL_RESOURCE_ATTRIBUTES` env var (set in `EdotReactNativeAgent.swift` before agent start). No JS-side resource detection — see `ios/AGENTS.md`.

### iOS Metrics Pipeline

The iOS module replaces apm-agent-ios's global `MeterProvider` with a resource-aware one (`EdotMeterProviderFactory`). Pipeline: `PeriodicMetricReader (60s) → Logging? → Persistence (Caches/elastic/) → CentralConfigGate → HTTP|gRPC`. Default transport gRPC; `exportProtocol: "http"` overrides. `EdotAppMetrics` (MetricKit `application.launch.time`) and `EdotSystemMetrics` (CPU/memory observable gauges) replace apm-agent-ios's reimplementations because they emit through the resource-less global. The `CentralConfigGate` (`EdotCentralConfigMetricExporter`) is a deliberate divergence — upstream v2.0.0 doesn't gate metrics on the central-config `recording` flag. See `ios/AGENTS.md` for the full set of load-bearing rules.

### Android Native Metrics, OkHttp Anti-Pattern, and Filters

See [`android/AGENTS.md`](./android/AGENTS.md) for the full Android-specific rules: `application.launch.time` histogram bucket boundaries, `system.cpu.usage` / `system.memory.usage` observable gauges, the "don't add `co.elastic.otel.android.instrumentation.okhttp`" anti-pattern, span/log exporter filters, and `disableAgent` plumbing.

### JS Bridge Forwarding for Native-Only Config Keys

`mergeConfig` in `EdotReactNative.ts` is the single source of truth for what reaches the native bridge. Top-level config keys whose values only matter to native code (`disableAgent`, `managementUrl`, `remoteManagement`, `persistencePreset`, `ignoreSpanNames`, `ignoreLogPatterns`) must be explicitly spread into the returned `InternalConfig` — otherwise they're silently dropped at the JS layer and the native side reads `null`. Platform-specific keys (`config.ios.*` / `config.android.*`) flow automatically via `...platformExtras`. Regex-bearing fields (`ignoreSpanNames`, `ignoreLogPatterns.name`) use the `RegexSource` shape (`{ source, flags }`) because real `RegExp` objects don't survive the bridge.

### App-State Tracking

`instrumentation/app-state.ts` installs one `AppState.addEventListener('change', ...)` listener (gated by `EDOT_DEFAULTS.appStateTracking: true`). On `'background'`: ends the active screen-lifetime span via `EdotNativeModule.endSpan(spanId, 1)` and clears `ActiveViewContext`. On `'inactive'`: no-op. On `'active'` after a real background: invokes `ActiveViewContext.notifyForegroundReEmitters()` so each navigation plugin replays its current screen with `previousScreenName = null` (resulting span omits `last.screen.name`). The handler tracks `wasBackgrounded` internally so a transient `inactive → active` (Face ID resolved) does not trigger re-emit.

### Screen Correlation on Network/Error/Interaction Spans

`fetch.ts`, `xhr.ts`, and the interactions HOC/hook read `ActiveViewContext.getActiveView()` at span-start time and stamp `screen.name` and (for fetch/xhr) `screen.id` on the span. Mirrors opentelemetry-android's `ScreenAttributesSpanProcessor` behavior at the JS layer (iOS apm-agent has no equivalent processor). `screen.id` is an RN-specific value-add — Android upstream only emits `screen.name`. Errors don't restamp screen attrs — they attach to the view span directly via `recordSpanException`, which the native side renders as an OTel `exception` event under that span (so screen correlation comes from the parent span automatically).

### JS Error Dispatch

`errors.ts:reportError` routes uncaught exceptions and promise rejections by `isFatal` flag and active-view presence:

- **Fatal** (`ErrorUtils.setGlobalHandler` with `isFatal=true`) → `EdotNativeModule.reportJsException({ ..., isFatal: true })`. Native bridge (Swift `EdotReactNative.swift:reportJsException`, Kotlin `EdotReactNativeModuleImpl.kt:reportJsException`) emits an OTel log record with `event.name="crash"`, `event.domain="device"`, `exception.type`, `exception.message`, `exception.stacktrace` per [Elastic mobile crash event spec](https://github.com/elastic/apm/blob/main/specs/agents/mobile/events.md#crashes) — so fatal JS errors surface alongside native crashes in Kibana's Crashes panel.
- **Non-fatal + active view** → `EdotNativeModule.recordSpanException(activeView.spanId, ...)`. Native side calls `span.addEvent("exception", ...)` (OTel-standard exception event) on the active view span. Status is **not** auto-flipped to ERROR — the view span is a load-latency span, the exception event itself is the signal.
- **Non-fatal + no active view** → `EdotNativeModule.emitLog('error', message, { 'event.name': 'exception', ... })`. Stand-alone OTel log record with the exception event marker.

The legacy `'JS Error'` (JS-side) and `'js_error: <name>'` (native-side) spans were removed. They were OTel-incorrect (exceptions are events, not spans) and they didn't match the Elastic mobile crash event shape, so JS crashes were invisible to native crash dashboards.

### HTTP Span Attribute Convention

`fetch.ts` and `xhr.ts` emit **legacy** HTTP semantic-conv attribute names (`http.method`, `http.url`, `http.status_code`, `http.scheme`, `http.target`, `net.peer.name`, `net.peer.port`, `http.request_body.size`, `http.response_body.size`) — NOT the v1.23 stable names (`http.request.method`, `url.full`, `http.response.status_code`, …). This matches:

1. The Elastic mobile attributes spec (`https://github.com/elastic/apm/blob/main/specs/agents/mobile/README.md`) — which documents legacy names as the "OTel Convention" agents should send; APM Server remaps to ECS field names internally.
2. apm-agent-ios v2.0.0 via opentelemetry-swift v2.2.1's `URLSessionLogger` (which emits the same legacy names on native HTTP spans).

This alignment lets apm-agent-ios's `ElasticSpanProcessor` recognize JS HTTP spans as HTTP via `isHttpSpan()` (which keys on `http.url` presence) and apply the same enrichment as native: `network.connection.type` via `NetworkStatusInjector`, synthetic-parent transaction wrapping for orphan spans. See `ios/AGENTS.md` "JS-driven HTTP Spans Get Native Enrichment Automatically".

### Native UIKit View-Controller Instrumentation

`enableViewControllerInstrumentation` defaults to **false** in the RN SDK (overrides apm-agent-ios's upstream default of `true`). The unified `@inoxth/react-native-edot-navigation` package (covering react-navigation, expo-router, and Wix) emits route-named view spans; the native `viewDidAppear:` swizzle would compete with them and — on `react-native-screens` — emits spans named `RNSScreen` (the wrapper VC class) because the VC `title` isn't populated when the swizzle fires. Opt-in via JS config (`enableViewControllerInstrumentation: true`) if you want raw UIVC spans.

### Initialization Ordering — Mount Navigation After `initialize()` Resolves

`EdotReactNative.initialize(...)` is async. Until it resolves, `OpenTelemetry.instance.tracerProvider` on iOS is the default no-op provider, so `startSpan` calls succeed but produce spans that never export. The navigation provider emits the initial screen span synchronously on mount — if the navigator is mounted before `initialize()` resolves, the **initial** screen span is silently dropped. Consumers must wait for `initialize()` to resolve before mounting the navigation root. See `packages/react-native-navigation/AGENTS.md` for the pattern and the `example/react-navigation/` `sdkReady` gate.

For Wix consumers: `registerEdotNavigationListener` is called inside `Navigation.events().registerAppLaunchedListener` after `await EdotReactNative.initialize(...)`, before `Navigation.setRoot(...)` — so the home screen's first `componentDidAppear` is captured by the listener but only after the SDK is ready.

### Configuration Surface (recent additions)

JS-callable config knobs that pass through to apm-agent-ios v2.0.0's builder:

- `disableAgent` — fully suppresses native agent startup
- `persistencePreset: 'default' | 'lowUsage' | 'highVolume'` — tunes `PersistencePerformancePreset`
- `managementUrl` + `remoteManagement` — separate central-config endpoint
- `ios.useOpAMP` — opt-in OpAMP central-config protocol
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

`build.gradle.kts` reads the `newArchEnabled` Gradle property and selects `src/newarch/java` or `src/oldarch/java` for the `main` sourceSet; both define the same `com.edot.reactnative.EdotReactNativeModule` class delegating to `EdotReactNativeModuleImpl.kt`. See [`android/AGENTS.md`](./android/AGENTS.md) for the full Android module layout and load-bearing rules.

## Dependencies

- `@inoxth/react-native-edot-shared` (workspace)
- Peer: `react >=18.0.0`, `react-native >=0.75.0` (required for `spm_dependency`)

## Testing

Jest with `react-native` preset. `moduleNameMapper` resolves `@inoxth/react-native-edot-shared` to `../shared/src/`.
