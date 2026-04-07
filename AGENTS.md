# AGENTS.md

## Overview

EDOT React Native SDK — an OpenTelemetry-compliant observability SDK wrapping native EDOT iOS/Android agents. Auto-instruments network requests (fetch + XHR), JS errors, app lifecycle, startup, and navigation. Published under `@inox-edot/*` scope.

React Native 0.72+, supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric).

## Commands

```bash
yarn typecheck                    # TypeScript check (tsc --build, composite)
yarn test                         # Jest across all packages
yarn lint                         # oxlint (NOT eslint)
yarn fmt                          # oxfmt (NOT prettier)
yarn build                        # bob build for all @inox-edot/* packages

# Single test file
yarn jest packages/react-native/src/__tests__/errors.test.ts

# E2E (run from example/)
cd example && npx detox build --configuration ios.sim.release
cd example && npx detox test --configuration ios.sim.release
```

## Project Structure

```
packages/
├── core/                          # @inox-edot/core
├── react-native/                  # @inox-edot/react-native
├── react-native-navigation/       # @inox-edot/react-native-navigation
├── react-native-expo-router/      # @inox-edot/react-native-expo-router
├── react-native-wix-navigation/   # @inox-edot/react-native-wix-navigation
├── react-native-tracer-provider/  # @inox-edot/react-native-tracer-provider
└── cli/                           # @inox-edot/cli
example/                           # Demo RN app with Detox E2E tests
openspec/                          # OpenSpec specs and change tracking
```

### Packages

| Package | Description |
|---|---|
| `@inox-edot/core` | Shared cross-package state (`ActiveViewContext` singleton). Pure JS/TS — no React Native dependency. All navigation plugins depend on this. |
| `@inox-edot/react-native` | Main SDK. Config validation, native bridge (TurboModule + NativeModules + no-op fallback), auto-instrumentation (fetch, XHR, errors, lifecycle, startup, span cleanup), public API (`EdotReactNative.initialize()`, `setUser()`, `log()`), and React components (`EdotErrorBoundary`, `withEdotTracking`, `useEdotAction`). |
| `@inox-edot/react-native-navigation` | React Navigation (`@react-navigation/native`) integration. Creates view spans on route changes via `createEdotNavigationContainerRef()`. |
| `@inox-edot/react-native-expo-router` | Expo Router integration. Creates view spans on pathname changes via `<EdotExpoNavigationProvider>` wrapper component. |
| `@inox-edot/react-native-wix-navigation` | Wix react-native-navigation integration. Creates view spans on `ComponentDidAppear` events via `registerEdotNavigationListener()`. |
| `@inox-edot/react-native-tracer-provider` | Manual instrumentation API. Exposes `getTracerProvider()`, `getMeterProvider()`, `withSpanContext()` for custom spans and metrics. |
| `@inox-edot/cli` | CLI tool for source map upload. `edot upload-sourcemap` POSTs bundle + map to EDOT server for server-side crash symbolication. |

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

Singleton in `@inox-edot/core` — navigation plugins write to it (`setActiveView`), instrumentation modules read from it (`getActiveView`). The main package re-exports at `@inox-edot/react-native/active-view-context` for backwards compat. Navigation plugins import from `@inox-edot/core` directly.

### Navigation Plugin Pattern

All three plugins (`react-native-navigation`, `react-native-expo-router`, `react-native-wix-navigation`) follow the same structure:
1. Listen for screen changes (library-specific API)
2. End previous view span via `EdotNativeModule.endSpan()`
3. Start new span via `EdotNativeModule.startSpan()` with `view.name`, `view.previous`, `view.transition_type` attributes
4. Update `ActiveViewContext.setActiveView()`
5. Lazy-require `@inox-edot/react-native/nativeModule` to avoid circular deps

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
| Shared cross-package types | `packages/core/src/` |
| Specs / requirements | `openspec/specs/` |

## Conventions

### Tooling
- **Linting**: oxlint with `correctness: error`, `suspicious: warn`. Config in `oxlintrc.json`.
- **Formatting**: oxfmt — 100 char width, single quotes, trailing commas. Config in `.oxfmtrc.json`.
- **TypeScript**: Strict mode. Composite project references in root `tsconfig.json`. Each package has `tsconfig.json` + `tsconfig.build.json`.
- **Package builds**: `react-native-builder-bob` outputs CommonJS + ESM + TypeScript declarations to `lib/`. The CLI package uses plain `tsc`.

### Testing
- Jest with `react-native` preset for RN packages, `babel-jest` for the CLI package.
- Each package has its own `jest.config.js`.
- Cross-package imports resolved via `moduleNameMapper` pointing to sibling `src/` dirs (e.g., `'^@inox-edot/core$': '<rootDir>/../core/src/index.ts'`).
- E2E via Detox in `example/e2e/`. Elements use `testID` props.

### Example App
- Uses `installConfig.hoistingLimits: "workspaces"` in `package.json` — required so `react-native` stays in `example/node_modules/` for iOS xcodebuild scripts.
- Metro config adds root workspace as watch folder and maps `@inox-edot/react-native` to the local package.
- Detox targets iPhone 17 Pro / iOS 26.4 simulator.

### OpenSpec Workflow
Changes tracked in `openspec/changes/` with proposal → design → specs → tasks artifacts. Archived after implementation to `openspec/changes/archive/`. Main specs live in `openspec/specs/`. Use `/opsx:propose`, `/opsx:apply`, `/opsx:archive` skills.

## Anti-Patterns

- **Don't import `ActiveViewContext` from `@inox-edot/react-native`** in navigation plugins — import from `@inox-edot/core` to avoid circular dependency.
- **Don't eagerly import `@inox-edot/react-native/nativeModule`** at top level in nav plugins — use lazy `require()` inside a function to break the dependency cycle.
- **Don't add React Native dependencies to `@inox-edot/core`** — it must stay pure JS/TS.
- **Don't use `Object` (capital O)** in TurboModule specs — use `object` (lowercase).
- **Don't manually construct `node_modules` paths** — use yarn workspace resolution and `moduleNameMapper` in jest configs.
- **Don't commit `lib/` or `src/**/*.js`** build artifacts — they're gitignored.
