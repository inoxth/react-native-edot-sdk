# AGENTS.md

## Overview

EDOT React Native SDK — an OpenTelemetry-compliant observability SDK wrapping native EDOT iOS/Android agents. Auto-instruments network requests (fetch + XHR), JS errors, app lifecycle, startup, and navigation. Published under `@inox/*` scope.

React Native 0.75+ (required for the `spm_dependency` Cocoapods helper), supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase via legacy interop.

## Commands

```bash
yarn typecheck                    # TypeScript check (tsc --build, composite)
yarn test                         # Jest across all packages
yarn lint                         # oxlint (NOT eslint)
yarn fmt                          # oxfmt (NOT prettier)
yarn build                        # bob build for all @inox/* packages

# Single test file
yarn jest packages/react-native/src/__tests__/errors.test.ts
```

## Project Structure

```
packages/
├── shared/                        # @inox/react-native-edot-shared
├── react-native/                  # @inox/react-native-edot-sdk
├── react-native-navigation/       # @inox/react-native-edot-navigation
├── react-native-expo-router/      # @inox/react-native-edot-expo-router
├── react-native-wix-navigation/   # @inox/react-native-edot-wix-navigation
├── react-native-tracer-provider/  # @inox/react-native-edot-tracer-provider
└── cli/                           # @inox/react-native-edot-cli
example/                           # 4 demo apps (see example/AGENTS.md)
openspec/                          # OpenSpec specs and change tracking
```

### Packages

Each package has its own `CLAUDE.md` and `AGENTS.md` with detailed documentation.

| Package | Description | Docs |
|---|---|---|
| `@inox/react-native-edot-shared` | Shared cross-package state (`ActiveViewContext` singleton). Pure JS/TS. | [AGENTS.md](./packages/shared/AGENTS.md) |
| `@inox/react-native-edot-sdk` | Main SDK. Config, native bridge, auto-instrumentation, public API, React components. | [AGENTS.md](./packages/react-native/AGENTS.md) |
| `@inox/react-native-edot-navigation` | React Navigation integration. View spans on route changes. | [AGENTS.md](./packages/react-native-navigation/AGENTS.md) |
| `@inox/react-native-edot-expo-router` | Expo Router integration. View spans on pathname changes. | [AGENTS.md](./packages/react-native-expo-router/AGENTS.md) |
| `@inox/react-native-edot-wix-navigation` | Wix react-native-navigation integration. View spans on `ComponentDidAppear`. | [AGENTS.md](./packages/react-native-wix-navigation/AGENTS.md) |
| `@inox/react-native-edot-tracer-provider` | Manual instrumentation API. Custom spans and metrics. | [AGENTS.md](./packages/react-native-tracer-provider/AGENTS.md) |
| `@inox/react-native-edot-cli` | CLI tool for source map upload. | [AGENTS.md](./packages/cli/AGENTS.md) |

## Architecture

### Native Bridge

`EdotNativeModule` (`packages/react-native/src/nativeModule.ts`) is the single gateway to native code. It loads the native module with TurboModule-first fallback to `NativeModules`, then a no-op Proxy when neither is available. The TurboModule spec is `NativeEdotReactNative.ts`. Span creation (`startSpan`) returns a span ID synchronously — the native side holds the actual span in a thread-safe registry.

### Native Module — Platform Differences

**iOS** (`packages/react-native/ios/`): Swift implementation gated by `#if ELASTIC_APM_AVAILABLE`. `EdotReactNative.swift` calls `ElasticApmAgent` directly. `EdotReactNative.m` is the Obj-C bridge (`RCT_EXTERN_MODULE`) — under New Arch, `RCTLegacyInteropModuleProvider` wraps the legacy bridge module so the same `.m`/`.swift` pair drives both architectures. `EdotReactNativeAgent.swift` allows pre-initialization from AppDelegate before the JS bridge loads — it requires `serviceName`, `serviceVersion`, and `deploymentEnvironment` (all non-blank, no `,` or `=`) and injects them into the OTel `Resource` via `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. The `EdotReactNative.podspec` at the package root is a real podspec — it compiles `ios/**/*.{swift,h,m}` and declares the `apm-agent-ios` SPM dependency via React Native's top-level `spm_dependency` helper (RN 0.75+; resolved by `SPMManager#apply_on_post_install` in `react_native/scripts/cocoapods/spm.rb`). The pod target sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = ELASTIC_APM_AVAILABLE` so example apps need **no** SPM refs, EDOT source-file refs, bridging-header settings, or app-level compilation conditions in their `project.pbxproj`.

**Android** (`packages/react-native/android/`): Kotlin implementation with arch-conditional source sets. Shared logic lives in `EdotReactNativeModuleImpl.kt` under `src/main/`. `src/oldarch/java/` contains an `EdotReactNativeModule` extending `ReactContextBaseJavaModule` with `@ReactMethod` annotations; `src/newarch/java/` contains one extending the codegen-generated `NativeEdotReactNativeSpec` with `override fun`. Gradle picks the right directory via `IS_NEW_ARCHITECTURE_ENABLED` BuildConfig + sourceSet selection. `EdotReactNativePackage` extends `BaseReactPackage` with `getReactModuleInfoProvider()` so both architectures use the same package class. `initialize()` starts the agent programmatically via `EdotReactNativeAgent.buildFromJsConfig(...)` using the JS-supplied config. `getCurrentSessionId()` returns `""` — ElasticApmAgent 1.5.0 exposes `SessionManager` only as an internal `$agent_sdk` API. The EDOT Gradle plugin (`co.elastic.otel.android.agent`) v1.5.0 is still applied in all example apps (requires Gradle 8.7+, AGP 8.9.1+, compileSdk 36) for build-time code-generation and instrumentation hooks.

### Initialization Flow

`EdotReactNative.initialize(config)` in `EdotReactNative.ts`:
1. Validates config via `validateConfig()` — required fields (`serverUrl`, `serviceName`, `serviceVersion`, `deploymentEnvironment`), resource-identity character restrictions (no `,` or `=`), `secretToken`/`apiKey` mutual exclusivity, `sessionSamplingRate` range
2. Flattens the native config (spreads `config.ios` or `config.android` onto the top-level payload sent to the bridge)
3. Calls `EdotNativeModule.initialize()` — on Android this starts the agent programmatically via `EdotReactNativeAgent.buildFromJsConfig(...)` unless pre-initialized; on iOS this calls `ElasticApmAgent.start(...)` unless `EdotReactNativeAgent.preInitialize(...)` was called earlier from AppDelegate
4. Sets up JS-side instrumentation based on `EDOT_DEFAULTS`-merged toggles (fetch, XHR, errors, lifecycle, startup) plus unconditional `setupSpanCleanup`
5. Each setup function returns a teardown function stored in `teardowns[]`; `_resetForTesting()` drains them

### ActiveViewContext

Singleton in `@inox/react-native-edot-shared` — navigation plugins write to it (`setActiveView`), instrumentation modules read from it (`getActiveView`). The main package re-exports at `@inox/react-native-edot-sdk/active-view-context` for backwards compat. Navigation plugins import from `@inox/react-native-edot-shared` directly.

### Navigation Plugin Pattern

All three plugins (`react-native-navigation`, `react-native-expo-router`, `react-native-wix-navigation`) follow the same structure:
1. Listen for screen changes (library-specific API)
2. End previous view span via `EdotNativeModule.endSpan()`
3. Start new span via `EdotNativeModule.startSpan()` with `view.name`, `view.previous`, `view.transition_type` attributes
4. Update `ActiveViewContext.setActiveView()`
5. Lazy-require `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps

### Network Instrumentation

Fetch and XHR are monkey-patched to create OTel spans using v1.23 stable HTTP semantic conventions: `http.request.method`, `url.full` (sanitized via `config.urlSanitizer`), `http.request.body.size`, `http.response.status_code`, `http.response.body.size`. They inject a W3C `traceparent` header for URLs matching `tracePropagationTargets` and add an `X-Edot-RN-Traced: 1` dedup header on every traced request. When an active view exists, spans include `view.name` and `view.id` attributes. Body/response sizes and status code are written via the typed `setSpanAttributeNumber` bridge method to preserve numeric type end-to-end.

### iOS Metrics Pipeline (Custom MeterProvider)

apm-agent-ios v2.0.0 builds the global `MeterProvider` without `.setResource(...)`, so its metrics export under `unknown_service:*`. The iOS module bypasses the global and builds its own resource-aware `MeterProvider` via `EdotMeterProviderFactory` for `recordMetric`, `EdotAppMetrics`, and `EdotSystemMetrics`. Pipeline: `PeriodicMetricReader (60s) → Logging? → Persistence (Caches/elastic/) → CentralConfigGate → HTTP|gRPC`. Default transport is gRPC (matches apm-agent-ios trace/log default); set `exportProtocol: "http"` to override. The `CentralConfigGate` is a deliberate divergence — apm-agent-ios v2.0.0 does not honor `recording: Bool` on metrics, so we gate at the exporter boundary. See `packages/react-native/ios/AGENTS.md` for load-bearing rules.

### Credentials Redaction

`secretToken` and `apiKey` are wrapped in `redactedString(value)` from `@inox/react-native-edot-shared` immediately on `mergeConfig` (commit `e5f612f`). The wrapper's `toString()` / `toJSON()` return `"[REDACTED]"`, preventing accidental logging. `revealCredentials()` unwraps them just before the `EdotNativeModule.initialize(...)` call.

### Error Tracking

`errors.ts` installs two handlers: `ErrorUtils.setGlobalHandler()` for uncaught JS exceptions and Hermes `enablePromiseRejectionTracker` (with `promise/setimmediate/rejection-tracking` fallback for non-Hermes engines). Each reported error opens a short-lived span with `exception.type`/`exception.message`/`exception.stacktrace`/`error.source` and also calls `reportJsException` so the native side emits a structured error event. React render errors are captured separately by the opt-in `EdotErrorBoundary` component exported from `@inox/react-native-edot-sdk`. Service identity (`service.name`, `service.version`, `deployment.environment`) is carried on the OTel Resource (set by the native agent at start), not on each span.

## Where to Look

| Need | Location |
|---|---|
| Public API surface | `packages/react-native/src/index.ts` |
| Config shape / defaults | `types.ts`, `defaults.ts`, `config.ts` |
| Native method signatures | `NativeEdotReactNative.ts` (TurboModule spec) |
| iOS native implementation | `packages/react-native/ios/EdotReactNative.swift` (Swift) + `EdotReactNative.m` (RCT_EXTERN_MODULE bridge) |
| iOS distribution | `packages/react-native/EdotReactNative.podspec` (compiles iOS sources + declares `apm-agent-ios` via `spm_dependency`) |
| Android native implementation | `packages/react-native/android/src/main/.../EdotReactNativeModuleImpl.kt` (shared) + `src/{newarch,oldarch}/java/.../EdotReactNativeModule.kt` |
| Add new instrumentation | `packages/react-native/src/instrumentation/` — follow fetch.ts pattern |
| Add navigation plugin | Copy `packages/react-native-navigation/` — same structure |
| Shared cross-package types | `packages/shared/src/` |
| Specs / requirements | `openspec/specs/` |

## Dependency Graph

```
shared (pure JS/TS, no deps)
  |
react-native (core SDK, depends: shared)
  |
  +-- react-native-navigation (depends: sdk + shared)
  +-- react-native-expo-router (depends: sdk + shared)
  +-- react-native-wix-navigation (depends: sdk + shared)
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
- Cross-package imports resolved via `moduleNameMapper` pointing to sibling `src/` dirs (e.g., `'^@inox/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts'`).
- Mocking pattern: `jest.mock()` for native module, `jest.clearAllMocks()` in `beforeEach()`. All trackers/providers export `resetForTesting()` functions for test isolation.

### Example Apps
Four example apps under `example/`, each a yarn workspace member:
- `example/basic/` — SDK init, manual tracing, metrics, logs, network, errors, interactions (no navigation)
- `example/react-navigation/` — React Navigation with bottom tabs + nested stacks
- `example/expo-router/` — Expo Router with tab layout + nested routes
- `example/wix-navigation/` — Wix react-native-navigation with bottomTabs + push
- All use `.env` for config (server URL, service name, secret token). Copy `.env.example` to `.env`.
- Each has `installConfig.hoistingLimits: "workspaces"` so native deps resolve correctly.
- Metro configs add monorepo root as watch folder + extraNodeModules for `@inox/*` packages.
- RN versions vary by navigation library compatibility: basic + react-navigation use RN 0.85.1, expo-router + wix-navigation use RN 0.83.4. Min iOS 16.0, min Android SDK 24, compile/target SDK 36.
- Each app exposes both `ios`/`android` (New Arch, default) and `ios:old-arch`/`android:old-arch` scripts so contributors validate both architectures from the same workspace before shipping changes that touch the native modules.

### OpenSpec Workflow
Changes tracked in `openspec/changes/` with proposal -> design -> specs -> tasks artifacts. Archived after implementation to `openspec/changes/archive/`. Main specs live in `openspec/specs/`. Use `/opsx:propose`, `/opsx:apply`, `/opsx:archive` skills.

### Repo-Enforced Hooks
`.claude/hooks/` blocks: `eslint`/`prettier` invocations (oxlint/oxfmt only), `rm -rf`/`rm -r` (use `trash`), `git push` (developer pushes), `git -C`, and chained `git add && git commit`. `.claude/rules/typescript.md` adds: explicit return types on exports, `unknown` only at system boundaries with immediate Zod `.parse()`, Zod imports must be `from "zod/v4"`.

## Anti-Patterns

- **Don't import `ActiveViewContext` from `@inox/react-native-edot-sdk`** in navigation plugins — import from `@inox/react-native-edot-shared` to avoid circular dependency.
- **Don't eagerly import `@inox/react-native-edot-sdk/nativeModule`** at top level in nav plugins — use lazy `require()` inside a function to break the dependency cycle.
- **Don't add React Native dependencies to `@inox/react-native-edot-shared`** — it must stay pure JS/TS.
- **Don't use lowercase `object`** in TurboModule specs — use capital `Object`. RN codegen rejects `TSObjectKeyword`; capital `Object` maps to `GenericObjectTypeAnnotation`. The spec file has an oxlint file-level disable of `no-wrapper-object-types` with the rationale inline.
- **Don't manually construct `node_modules` paths** — use yarn workspace resolution and `moduleNameMapper` in jest configs.
- **Don't commit `lib/` or `src/**/*.js`** build artifacts — they're gitignored.
