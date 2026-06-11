# AGENTS.md

## Overview

React Native EDOT SDK — an OpenTelemetry-compliant observability SDK wrapping native EDOT iOS/Android agents. Auto-instruments network requests (fetch + XHR), JS errors, startup, and navigation. App lifecycle events are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec. Published under `@inoxth/*` scope.

React Native 0.75+ (required for the `spm_dependency` Cocoapods helper), supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase via legacy interop.

## Commands

```bash
yarn typecheck                    # TypeScript check (tsc --build, composite)
yarn test                         # Jest across all packages
yarn lint                         # oxlint (NOT eslint)
yarn fmt                          # oxfmt (NOT prettier)
yarn build                        # bob build for all @inoxth/* packages

# Single test file
yarn jest packages/react-native/src/__tests__/errors.test.ts
```

## Project Structure

```
packages/
├── shared/                        # @inoxth/react-native-edot-shared
├── react-native/                  # @inoxth/react-native-edot-sdk
├── react-native-navigation/       # @inoxth/react-native-edot-navigation (unified — covers react-navigation, expo-router, wix)
├── react-native-tracer-provider/  # @inoxth/react-native-edot-tracer-provider
└── cli/                           # @inoxth/react-native-edot-cli
example/                           # 4 demo apps (see example/AGENTS.md)
```

### Packages

Each package has its own `CLAUDE.md` and `AGENTS.md` with detailed documentation.

| Package | Description | Docs |
|---|---|---|
| `@inoxth/react-native-edot-shared` | Shared cross-package state (`ActiveViewContext` singleton). Pure JS/TS. | [AGENTS.md](./packages/shared/AGENTS.md) |
| `@inoxth/react-native-edot-sdk` | Main SDK. Config, native bridge, auto-instrumentation, public API, React components. | [AGENTS.md](./packages/react-native/AGENTS.md) |
| `@inoxth/react-native-edot-navigation` | Unified navigation integration. `<EdotNavigationProvider>` for `@react-navigation/native` + `expo-router` (both use `useNavigationContainerRef`); imperative `registerEdotNavigationListener` for Wix `react-native-navigation`. | [AGENTS.md](./packages/react-native-navigation/AGENTS.md) |
| `@inoxth/react-native-edot-tracer-provider` | Manual instrumentation API. Custom spans and metrics. | [AGENTS.md](./packages/react-native-tracer-provider/AGENTS.md) |
| `@inoxth/react-native-edot-cli` | CLI tool for source map upload. | [AGENTS.md](./packages/cli/AGENTS.md) |

## Architecture

### Native Bridge

`EdotNativeModule` (`packages/react-native/src/nativeModule.ts`) is the single gateway to native code. It loads the native module with TurboModule-first fallback to `NativeModules`, then a no-op Proxy when neither is available. The TurboModule spec is `NativeEdotReactNative.ts`. Span creation (`startSpan`) returns a span ID synchronously — the native side holds the actual span in a thread-safe registry.

### Native Module — Platform Differences

**iOS** (`packages/react-native/ios/`): Swift implementation gated by `#if ELASTIC_APM_AVAILABLE`. `EdotReactNative.swift` calls `ElasticApmAgent` directly. `EdotReactNative.m` is the Obj-C bridge (`RCT_EXTERN_MODULE`) — under New Arch, `RCTLegacyInteropModuleProvider` wraps the legacy bridge module so the same `.m`/`.swift` pair drives both architectures. `EdotReactNativeAgent.swift` allows pre-initialization from AppDelegate before the JS bridge loads — required: `serviceName`, `serviceVersion`, `deploymentEnvironment` (non-blank, no `,` or `=`); optional: `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol` (`secretToken`/`apiKey` mutually exclusive, `sessionSamplingRate` ∈ [0, 1]). It injects identity into the OTel `Resource` via `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. The `EdotReactNative.podspec` at the package root is a real podspec — it compiles `ios/**/*.{swift,h,m}` and declares the `apm-agent-ios` SPM dependency via React Native's top-level `spm_dependency` helper (RN 0.75+; resolved by `SPMManager#apply_on_post_install` in `react_native/scripts/cocoapods/spm.rb`). The pod target sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` so example apps need **no** SPM refs, EDOT source-file refs, bridging-header settings, or app-level compilation conditions in their `project.pbxproj`.

**Android** (`packages/react-native/android/`): Kotlin module bridging JS to `apm-agent-android` 1.1.0. Supports Old Arch (`ReactContextBaseJavaModule` + `@ReactMethod`) and New Arch (codegen-generated `NativeEdotReactNativeSpec`) via arch-conditional source sets, all delegating to a shared `EdotReactNativeModuleImpl.kt`. Two agent-start paths (`preInitialize` from `MainApplication`, `buildFromJsConfig` from JS init) start the agent; `buildFromJsConfig` also installs the exporter-filter interceptors (`ignoreSpanNames` / `ignoreLogPatterns`). `EdotAppMetrics.kt` and `EdotSystemMetrics.kt` fill the `application.launch.time` / `system.cpu.usage` / `system.memory.usage` gaps that `apm-agent-android` 1.1.0 doesn't auto-emit. See [`packages/react-native/android/AGENTS.md`](./packages/react-native/android/AGENTS.md) for the full Android module layout, load-bearing rules, and anti-patterns.

### Initialization Flow

`EdotReactNative.initialize(config)` in `EdotReactNative.ts`:
1. Validates config via `validateConfig()` — required fields (`serverUrl`, `serviceName`, `serviceVersion`, `deploymentEnvironment`), resource-identity character restrictions (no `,` or `=`), `secretToken`/`apiKey` mutual exclusivity, `sessionSamplingRate` range
2. Flattens the native config (spreads `config.ios` or `config.android` onto the top-level payload sent to the bridge)
3. Calls `EdotNativeModule.initialize()` — on Android this starts the agent programmatically via `EdotReactNativeAgent.buildFromJsConfig(...)` unless pre-initialized; on iOS this calls `ElasticApmAgent.start(...)` unless `EdotReactNativeAgent.preInitialize(...)` was called earlier from AppDelegate. When the agent **is** already pre-initialized, the JS init logs (under `debug`) any reserved fields it received that pre-init should have owned (`apiKey`, `sessionSamplingRate`, `exportProtocol`, plus `diskBufferingEnabled` on Android) — those values are silently ignored by the agent because it's already running, so the JS path can't apply them retroactively
4. Sets up JS-side instrumentation based on `EDOT_DEFAULTS`-merged toggles (fetch, XHR, errors, startup) plus unconditional `setupSpanCleanup`
5. Each setup function returns a teardown function stored in `teardowns[]`; `_resetForTesting()` drains them

### ActiveViewContext

Singleton in `@inoxth/react-native-edot-shared` — navigation plugins write to it (`setActiveView`), instrumentation modules read from it (`getActiveView`). The main package re-exports at `@inoxth/react-native-edot-sdk/active-view-context` for backwards compat. Navigation plugins import from `@inoxth/react-native-edot-shared` directly.

### Navigation Plugin Pattern (unified)

A single package `@inoxth/react-native-edot-navigation` covers all three navigators. Internally everything is built on the shared `createNavigationLifecycle` helper which handles span start/end, `ActiveViewContext` updates, and foreground re-emit:

1. **Ref-based navigators (`@react-navigation/native` + `expo-router`)** — same component `<EdotNavigationProvider navigationRef={…}>`. The provider subscribes to `addListener('state', …)` on the ref and reads `getCurrentRoute().name`. expo-router and react-navigation collapse cleanly because expo-router is built on top of react-navigation and re-exports `useNavigationContainerRef()`. Tracer scope: `@inoxth/react-native-edot-sdk/navigation`.
2. **Wix `react-native-navigation`** — imperative `registerEdotNavigationListener(Navigation, options)`. Hooks `Navigation.events().registerComponentDidAppearListener(...)`. Returned cleanup function unsubscribes + tears down the lifecycle. Wix is imperative because Wix apps have no continuously-mounted React root. Tracer scope: `@inoxth/react-native-edot-sdk/navigation` (shared with the ref-based surface — the package owns one OTel scope).
3. Both surfaces emit the same span shape: name = `"<route name> - view appearing"` (post-mapper; suffix matches EDOT iOS/Android view-appearing span naming so screen views aggregate correctly in Elastic dashboards), kind = INTERNAL, attribute `screen.name` (and `last.screen.name` when the prior screen exists and differs).
4. Both surfaces register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` so the SDK's `AppState` listener can replay the current screen on foreground (treated as fresh visit; `last.screen.name` omitted).
5. The package never imports any of the three navigator libraries — props/arguments are duck-typed via local `NavigationContainerRefLike` and `WixNavigationLike` interfaces. All three are declared as **optional** peer dependencies via `peerDependenciesMeta`.

### Network Instrumentation

Fetch and XHR are monkey-patched to create OTel spans using legacy Elastic mobile spec HTTP attribute names: `http.method`, `http.url` (sanitized via `config.urlSanitizer`), `http.request_body.size`, `http.status_code`, `http.response_body.size`. They inject a W3C `traceparent` header on **all** outbound requests when `tracePropagationTargets` is omitted (matching the iOS `apm-agent-ios` default; `serverUrl` and `ignoreUrls` matches are still excluded via `shouldIgnore`). Pass `tracePropagationTargets: []` to opt out entirely, or a non-empty array to restrict propagation to an allowlist. Every traced request also carries an `X-Edot-RN-Traced: 1` dedup header. When an active view exists, spans include `screen.name` and `screen.id` attributes (RN-specific value-add over apm-agent-android's `ScreenAttributesSpanProcessor`, which only emits `screen.name`). Both fetch and XHR pass `instrumentationName = "@inoxth/react-native-edot-sdk/http"` so HTTP spans carry a unified `instrumentation.scope.name` (matched by iOS's native `URLSessionInstrumentation` which is configured with the same scope). Body/response sizes and status code are written via the typed `setSpanAttributeNumber` bridge method to preserve numeric type end-to-end.

### iOS Metrics (apm-agent-ios 1.2.1)

No custom metrics pipeline. `recordMetric` uses the agent's legacy (resource-aware) global meter (`OpenTelemetry.instance.meterProvider`), and `application.launch.time` / `system.cpu.usage` / `system.memory.usage` come from apm-agent-ios 1.2.1's built-in `AppMetrics` / `CPUSampler` / `MemorySampler` (same names + `state=app` as Android), toggled by `enableAppMetricInstrumentation` / `enableSystemMetrics`. The 2.x-era custom `MeterProvider` + central-config gate (`EdotMeterProviderFactory` / `EdotCentralConfigMetricExporter`) was removed in the downgrade. See `packages/react-native/ios/AGENTS.md` and `docs/parity-after-downgrade.md`.

### Credentials Redaction

`secretToken` and `apiKey` are wrapped in `redactedString(value)` from `@inoxth/react-native-edot-shared` immediately on `mergeConfig` (commit `e5f612f`). The wrapper's `toString()` / `toJSON()` return `"[REDACTED]"`, preventing accidental logging. `revealCredentials()` unwraps them just before the `EdotNativeModule.initialize(...)` call.

### App-State Tracking

`packages/react-native/src/instrumentation/app-state.ts` installs a single `AppState.addEventListener('change', ...)` listener (gated by `EDOT_DEFAULTS.appStateTracking: true`). On `'background'`: ends the active screen-lifetime span via `EdotNativeModule.endSpan(spanId, 1)` and clears `ActiveViewContext`. On `'inactive'`: no-op (avoids thrashing on transient Face ID prompts / app-switcher half-pulled). On `'active'` after a real background: invokes `ActiveViewContext.notifyForegroundReEmitters()` — registered plugins reset their `previousScreenName = null` and re-run their first-emission path (so the new span omits `last.screen.name`). The new screen-lifetime span has a fresh `screen.id` — network requests started before background carry the old (now-ended) `screen.id` by design.

### Error Tracking

`errors.ts` installs two handlers: `ErrorUtils.setGlobalHandler()` for uncaught JS exceptions and Hermes `enablePromiseRejectionTracker` (with `promise/setimmediate/rejection-tracking` fallback for non-Hermes engines). `reportError(error, source, isFatal)` routes by `isFatal` and active-view presence — JS-side error spans were removed in commit `ef2e045` because exceptions are OTel events, not spans:

- **Fatal** → `EdotNativeModule.reportJsException({ ..., isFatal: true })`. Native bridge emits an OTel log record with `event.name="crash"`, `event.domain="device"`, `exception.type`/`exception.message`/`exception.stacktrace` per the Elastic mobile crash event spec — so fatal JS errors surface alongside native crashes in Kibana's Crashes panel.
- **Non-fatal + active view** → `EdotNativeModule.recordSpanException(activeView.spanId, ...)`. Native side calls `span.addEvent("exception", ...)` on the active view span. Status is **not** auto-flipped to ERROR (the view span is a load-latency span; the exception event itself is the signal). Screen correlation flows from the parent view span automatically.
- **Non-fatal + no active view** → `EdotNativeModule.emitLog('error', message, { 'event.name': 'exception', 'exception.type', 'exception.message', 'exception.stacktrace', 'error.source' })`. Stand-alone OTel log record with the exception event marker.

React render errors are captured separately by the opt-in `EdotErrorBoundary` component exported from `@inoxth/react-native-edot-sdk`. Service identity (`service.name`, `service.version`, `deployment.environment`) is carried on the OTel Resource (set by the native agent at start), not on each span.

## Where to Look

| Need | Location |
|---|---|
| Public API surface | `packages/react-native/src/index.ts` |
| React init hook | `packages/react-native/src/hooks/useEdot.ts` — `useEdot(config)` returns `{ ready, error }`, first-wins capture, dev warning on native-key change |
| Config shape / defaults | `types.ts`, `defaults.ts`, `config.ts` |
| Native method signatures | `NativeEdotReactNative.ts` (TurboModule spec) |
| iOS native implementation | `packages/react-native/ios/EdotReactNative.swift` (Swift) + `EdotReactNative.m` (RCT_EXTERN_MODULE bridge) |
| iOS distribution | `packages/react-native/EdotReactNative.podspec` (compiles iOS sources + declares `apm-agent-ios` via `spm_dependency`) |
| Android native implementation | `packages/react-native/android/src/main/.../EdotReactNativeModuleImpl.kt` (shared) + `src/{newarch,oldarch}/java/.../EdotReactNativeModule.kt` |
| Add new instrumentation | `packages/react-native/src/instrumentation/` — follow fetch.ts pattern |
| Add support for a new navigator | Build on `createNavigationLifecycle` in `packages/react-native-navigation/src/navigation-lifecycle.ts` — same surface as the existing component / wix listener |
| Shared cross-package types | `packages/shared/src/` |

## Dependency Graph

```
shared (pure JS/TS, no deps)
  |
react-native (core SDK, depends: shared)
  |
  +-- react-native-navigation (unified — depends: sdk + shared; 3 optional navigator peer deps)
  +-- react-native-tracer-provider (depends: sdk only)

cli (standalone Node.js, depends: commander only)
```

## Conventions

### Tooling
- **Linting**: oxlint with `correctness: error`, `suspicious: warn`, `typescript/no-explicit-any: error`. Config in `oxlintrc.json`. Ignores `node_modules`, `lib`, `*.d.ts`, `example`.
- **Formatting**: oxfmt — 100 char width, single quotes, trailing commas. Config in `.oxfmtrc.json`. Ignores `node_modules`, `lib`, `*.d.ts`, `example/ios`, `example/android`.
- **TypeScript**: Strict mode, `moduleResolution: bundler`. Composite project references in root `tsconfig.json`. Each package has `tsconfig.json` + `tsconfig.build.json`.
- **Package builds**: `react-native-builder-bob` outputs CommonJS + ESM + TypeScript declarations to `lib/`. The CLI package uses plain `tsc`.

### Testing
- Jest with `react-native` preset for RN packages, `node` environment + `babel-jest` for the CLI package.
- Each package has its own `jest.config.js`.
- Cross-package imports resolved via `moduleNameMapper` pointing to sibling `src/` dirs (e.g., `'^@inoxth/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts'`).
- Mocking pattern: `jest.mock()` for native module, `jest.clearAllMocks()` in `beforeEach()`. All trackers/providers export `resetForTesting()` functions for test isolation.

### Example Apps
Four example apps under `example/`, each a yarn workspace member:
- `example/basic/` — SDK init, manual tracing, metrics, logs, network, errors, interactions (no navigation)
- `example/react-navigation/` — React Navigation with bottom tabs + nested stacks
- `example/expo-router/` — Expo Router with tab layout + nested routes
- `example/wix-navigation/` — Wix react-native-navigation with bottomTabs + push
- All use `.env` for config (server URL, service name, secret token). Copy `.env.example` to `.env`.
- Each has `installConfig.hoistingLimits: "workspaces"` so native deps resolve correctly.
- Metro configs add monorepo root as watch folder + extraNodeModules for `@inoxth/*` packages.
- RN versions vary by navigation library compatibility: basic + react-navigation use RN 0.85.1, expo-router + wix-navigation use RN 0.83.4. Min iOS 15.6, min Android SDK 24, compile/target SDK 36.
- Each app exposes both `ios`/`android` (New Arch, default) and `ios:old-arch`/`android:old-arch` scripts so contributors validate both architectures from the same workspace before shipping changes that touch the native modules.

### Repo-Enforced Hooks
`.claude/hooks/` blocks: `eslint`/`prettier` invocations (oxlint/oxfmt only), `rm -rf`/`rm -r` (use `trash`), `git push` (developer pushes), `git -C`, and chained `git add && git commit`. `.claude/rules/typescript.md` adds: explicit return types on exports, `unknown` only at system boundaries with immediate Zod `.parse()`, Zod imports must be `from "zod/v4"`.

## Anti-Patterns

- **Don't import `ActiveViewContext` from `@inoxth/react-native-edot-sdk`** in navigation plugins — import from `@inoxth/react-native-edot-shared` to avoid circular dependency.
- **Don't eagerly import `@inoxth/react-native-edot-sdk/nativeModule`** at top level in nav plugins — use lazy `require()` inside a function to break the dependency cycle.
- **Don't add React Native dependencies to `@inoxth/react-native-edot-shared`** — it must stay pure JS/TS.
- **Don't use lowercase `object`** in TurboModule specs — use capital `Object`. RN codegen rejects `TSObjectKeyword`; capital `Object` maps to `GenericObjectTypeAnnotation`. The spec file has an oxlint file-level disable of `no-wrapper-object-types` with the rationale inline.
- **Don't manually construct `node_modules` paths** — use yarn workspace resolution and `moduleNameMapper` in jest configs.
- **Don't commit `lib/` or `src/**/*.js`** build artifacts — they're gitignored.
