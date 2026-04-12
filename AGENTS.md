# AGENTS.md

## Overview

EDOT React Native SDK — an OpenTelemetry-compliant observability SDK wrapping native EDOT iOS/Android agents. Auto-instruments network requests (fetch + XHR), JS errors, app lifecycle, startup, and navigation. Published under `@inox/*` scope.

React Native 0.72+, supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric).

## Commands

```bash
yarn typecheck                    # TypeScript check (tsc --build, composite)
yarn test                         # Jest across all packages
yarn lint                         # oxlint (NOT eslint)
yarn fmt                          # oxfmt (NOT prettier)
yarn build                        # bob build for all @inox/* packages

# Single test file
yarn jest packages/react-native/src/__tests__/errors.test.ts

# E2E (run from each example app directory, e.g. example/basic/)
yarn e2e:build:ios     # build for iOS simulator
yarn e2e:test:ios      # run tests on iOS simulator
yarn e2e:build:android # build for Android emulator
yarn e2e:test:android  # run tests on Android emulator (requires Pixel_7_API_34 AVD)
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
example/                           # 4 demo apps with Detox E2E tests (see example/AGENTS.md)
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

### Initialization Flow

`EdotReactNative.initialize(config)` in `EdotReactNative.ts`:
1. Validates config via `validateConfig()` (throws on missing required fields, invalid values)
2. Merges with `EDOT_DEFAULTS`, applies platform-specific overrides (`config.ios` / `config.android`)
3. Calls `EdotNativeModule.initialize()` to start native agent
4. Sets up JS-side instrumentation based on config toggles (fetch, XHR, errors, lifecycle, startup, span cleanup)
5. Each setup function returns a teardown function stored in `teardowns[]`

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

Fetch and XHR are monkey-patched to create OTel spans. They capture `http.method`, `http.url` (sanitized), `http.status_code`, inject W3C `traceparent` for matching URLs, and add `X-Edot-RN-Traced: 1` dedup header. When an active view exists, spans include `view.name` and `view.id` attributes.

### Error Tracking

`errors.ts` installs three handlers: `ErrorUtils.setGlobalHandler()` for uncaught exceptions, Hermes promise rejection tracker (with `promise/setimmediate` fallback), and `EdotErrorBoundary` for React render errors. Error spans include `service.name`/`service.version`/`deployment.environment` for sourcemap symbolication routing.

## Where to Look

| Need | Location |
|---|---|
| Public API surface | `packages/react-native/src/index.ts` |
| Config shape / defaults | `types.ts`, `defaults.ts`, `config.ts` |
| Native method signatures | `NativeEdotReactNative.ts` (TurboModule spec) |
| Add new instrumentation | `packages/react-native/src/instrumentation/` — follow fetch.ts pattern |
| Add navigation plugin | Copy `packages/react-native-navigation/` — same structure |
| Shared cross-package types | `packages/shared/src/` |
| Specs / requirements | `openspec/specs/` |

## Dependency Graph

```
shared (pure JS/TS, no deps)
  ↓
react-native (core SDK, depends: shared)
  ↓
  ├── react-native-navigation (depends: sdk + shared)
  ├── react-native-expo-router (depends: sdk + shared)
  ├── react-native-wix-navigation (depends: sdk + shared)
  └── react-native-tracer-provider (depends: sdk only)

cli (standalone Node.js, depends: commander only)
```

## Conventions

### Tooling
- **Linting**: oxlint with `correctness: error`, `suspicious: warn`, `typescript/no-explicit-any: error`. Config in `oxlintrc.json`.
- **Formatting**: oxfmt — 100 char width, single quotes, trailing commas. Config in `.oxfmtrc.json`. Ignores `node_modules`, `lib`, `*.d.ts`, `example/ios`, `example/android`.
- **TypeScript**: Strict mode, `moduleResolution: bundler`. Composite project references in root `tsconfig.json`. Each package has `tsconfig.json` + `tsconfig.build.json`.
- **Package builds**: `react-native-builder-bob` outputs CommonJS + ESM + TypeScript declarations to `lib/`. The CLI package uses plain `tsc`.

### Testing
- Jest with `react-native` preset for RN packages, `node` environment + `babel-jest` for the CLI package.
- Each package has its own `jest.config.js`.
- Cross-package imports resolved via `moduleNameMapper` pointing to sibling `src/` dirs (e.g., `'^@inox/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts'`).
- Mocking pattern: `jest.mock()` for native module, `jest.clearAllMocks()` in `beforeEach()`. All trackers/providers export `resetForTesting()` functions for test isolation.
- E2E via Detox — all 4 example apps have `e2e/` suites. Elements use `testID` props. See [example/AGENTS.md](./example/AGENTS.md) for patterns.

### Example Apps
Four example apps under `example/`, each a yarn workspace member:
- `example/basic/` — SDK init, manual tracing, metrics, logs, network, errors, interactions (no navigation)
- `example/react-navigation/` — React Navigation with bottom tabs + nested stacks
- `example/expo-router/` — Expo Router with tab layout + nested routes
- `example/wix-navigation/` — Wix react-native-navigation with bottomTabs + push
- All use `.env` for config (server URL, service name, secret token). Copy `.env.example` to `.env`.
- Each has `installConfig.hoistingLimits: "workspaces"` so native deps resolve correctly.
- Metro configs add monorepo root as watch folder + extraNodeModules for `@inox/*` packages.

### OpenSpec Workflow
Changes tracked in `openspec/changes/` with proposal → design → specs → tasks artifacts. Archived after implementation to `openspec/changes/archive/`. Main specs live in `openspec/specs/`. Use `/opsx:propose`, `/opsx:apply`, `/opsx:archive` skills.

## Anti-Patterns

- **Don't import `ActiveViewContext` from `@inox/react-native-edot-sdk`** in navigation plugins — import from `@inox/react-native-edot-shared` to avoid circular dependency.
- **Don't eagerly import `@inox/react-native-edot-sdk/nativeModule`** at top level in nav plugins — use lazy `require()` inside a function to break the dependency cycle.
- **Don't add React Native dependencies to `@inox/react-native-edot-shared`** — it must stay pure JS/TS.
- **Don't use `Object` (capital O)** in TurboModule specs — use `object` (lowercase).
- **Don't manually construct `node_modules` paths** — use yarn workspace resolution and `moduleNameMapper` in jest configs.
- **Don't commit `lib/` or `src/**/*.js`** build artifacts — they're gitignored.
