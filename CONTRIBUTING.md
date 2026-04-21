# Contributing

Guide for working on the EDOT React Native SDK monorepo. For a product/architecture overview see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md); for adopter-facing setup see [README.md](./README.md); for AI-agent context see [AGENTS.md](./AGENTS.md) and each `packages/*/AGENTS.md`.

## Prerequisites

- **Node.js** ≥ 18 (see root `package.json` `engines`)
- **Yarn** 4.1.0 (pinned via `packageManager`; corepack will select it automatically — run `corepack enable` once)
- **JDK** 17
- **Xcode** with Command Line Tools (for iOS)
- **Android Studio** with SDK 36 and NDK 27 (for Android)
- **CocoaPods** 1.14+ (for iOS example apps)

## Repository Layout

```
.
├── packages/              # Library packages (published under @inox/*)
│   ├── react-native/                 # Core SDK — public API, native bridge, auto-instrumentation
│   ├── shared/                       # ActiveViewContext singleton (pure JS/TS)
│   ├── react-native-navigation/      # React Navigation integration
│   ├── react-native-expo-router/     # Expo Router integration
│   ├── react-native-wix-navigation/  # Wix react-native-navigation integration
│   ├── react-native-tracer-provider/ # Manual OTel tracing/metrics API
│   └── cli/                          # Source-map upload CLI
├── example/               # Four demo apps (basic, react-navigation, expo-router, wix-navigation)
├── openspec/              # Living capability specs + change tracking
│   ├── specs/                        # Main spec surface
│   └── changes/                      # In-flight and archived change proposals
├── docs/                  # High-level docs (ARCHITECTURE.md, ...)
└── .claude/               # Claude Code rules, skills, and settings
```

## Commands

Run from the repo root:

```bash
yarn install            # Install all workspace deps
yarn typecheck          # tsc --build (composite project references)
yarn test               # Jest across every package
yarn lint               # oxlint on ./packages
yarn fmt                # oxfmt on packages/
yarn build              # bob build for every @inox/* package (plus tsc for CLI)
```

Run a single test file:

```bash
yarn jest packages/react-native/src/__tests__/errors.test.ts
```

Per-package commands (from inside a package directory) mirror the root set (`yarn build`, `yarn typecheck`, `yarn test`, `yarn lint`).

## Toolchain

- **Package manager:** yarn 4 (never npm, never pnpm — don't regenerate lockfiles with other tools).
- **Linter:** `oxlint` with `correctness: error`, `suspicious: warn`, `typescript/no-explicit-any: error`. Config in `oxlintrc.json`.
- **Formatter:** `oxfmt` — 100-char line width, single quotes, trailing commas, 2-space indent. Config in `.oxfmtrc.json`.
- **TypeScript:** strict mode; `moduleResolution: bundler`. Composite project references declared in the root `tsconfig.json`; each package has `tsconfig.json` + `tsconfig.build.json`.
- **Bundling:** `react-native-builder-bob` produces CommonJS + ES Module + TypeScript declarations into each package's `lib/`. The CLI package uses plain `tsc` instead of bob.
- **Testing:** Jest with `react-native` preset for RN packages; `node` environment + `babel-jest` for the CLI. Cross-package imports resolve through `moduleNameMapper` pointing to sibling `src/` directories.

## Code Style

- **Named exports only.** No default exports except where framework requires them (e.g., TurboModule default export).
- **No `any` / `unknown` / `as Type` / `!` / `@ts-ignore`.** Define explicit types. `as const` is allowed (narrows, doesn't widen). See [`.claude/rules/typescript.md`](./.claude/rules/typescript.md).
- **No commented-out code** — delete it. See [`.claude/rules/comments.md`](./.claude/rules/comments.md).
- **Comments only when non-obvious.** Code should be self-documenting; a comment is for explaining WHY, not WHAT.

## Adding a New Instrumentation

Each `instrumentation/*.ts` file exports a `setup<Name>(config: EdotConfig): () => void` that monkey-patches a global or subscribes to an event source and returns a teardown function.

1. Create `packages/react-native/src/instrumentation/<name>.ts`.
2. Export `setup<Name>(config): () => void`.
3. Wire it into `EdotReactNative.ts` behind the matching `instrument<Name>` config toggle (or unconditionally, as `setupSpanCleanup` is).
4. Write unit tests in `packages/react-native/src/__tests__/` — mock `EdotNativeModule`, assert on `startSpan` / `setSpanAttribute*` / `endSpan` calls.

Follow `instrumentation/fetch.ts` as the canonical reference. Use OTel v1.23 semantic conventions for attribute names (e.g., `http.request.method`, not `http.method`).

## Adding a New Navigation Plugin

1. Copy `packages/react-native-navigation/` into `packages/react-native-<framework>/` and update `package.json` (name, peer deps).
2. Listen to the framework's route-change event.
3. On each change: end the current view span, call `EdotNativeModule.startSpan(...)` with `view.name` / `view.previous` / `view.transition_type`, call `ActiveViewContext.setActiveView(...)`.
4. Lazy-`require('@inox/react-native-edot-sdk/nativeModule')` inside a getter to break the circular dependency.
5. Import `ActiveViewContext` from `@inox/react-native-edot-shared` (never from the SDK).

## Native Development

### iOS

Native Swift source lives in `packages/react-native/ios/`. Changes are picked up by example apps because their Xcode projects include the sources directly (not via a Pod) — `ElasticApm` itself is an SPM dependency and CocoaPods cannot declare SPM deps.

```bash
# From an example app:
cd example/react-navigation/ios && pod install
open ExampleApp.xcworkspace
```

All Swift functions exposed to JS use `@objc` and are either:

- `@ReactMethod`-equivalent (Swift `@objc` + `RCTPromiseResolveBlock` / `RCTPromiseRejectBlock`) for async calls, or
- synchronous return types for blocking calls like `startSpan`.

Gate every call into `ElasticApm` with `#if ELASTIC_APM_AVAILABLE` so the module still compiles when the SPM dependency is absent (useful for tests).

### Android

Native Kotlin source lives in `packages/react-native/android/src/main/java/com/edot/reactnative/`. The runtime `ElasticApmAgent` starts programmatically from JS config via `EdotReactNativeAgent.buildFromJsConfig(...)` — consumers apply the EDOT Gradle plugin only to get `co.elastic.otel.android` onto the classpath.

```bash
# From an example app:
cd example/react-navigation/android
./gradlew :app:assembleDebug
```

TurboModule spec types: the RN codegen (0.83+ and 0.85+) requires capital `Object` in `NativeEdotReactNative.ts` for dictionary-shaped params — it maps to `GenericObjectTypeAnnotation` in `parsers-primitives.js`. Lowercase `object` (TSObjectKeyword) is rejected with `UnsupportedTypeAnnotationParserError`. The spec file has a top-of-file `oxlint-disable no-wrapper-object-types` with this rationale.

## Example Apps

Four demo apps under `example/` are yarn workspace members. Each has `installConfig.hoistingLimits: "workspaces"` so native deps resolve in-package. Metro config adds the monorepo root as a watch folder plus `extraNodeModules` for `@inox/*` packages.

| App | Navigation | Notes |
|---|---|---|
| `basic/` | None | SDK init + manual tracing only — single scrollable screen. |
| `react-navigation/` | React Navigation native-stack + bottom tabs | RN 0.85.1. Uses `createEdotNavigationContainerRef()`. |
| `expo-router/` | Expo Router (file-based) | RN 0.83.4. Wraps layout in `<EdotExpoNavigationProvider>`. Uses `babel-preset-expo` (not `@react-native/babel-preset`). |
| `wix-navigation/` | Wix react-native-navigation | RN 0.83.4. AppDelegate extends `RNNAppDelegate`. SDK init inside `registerAppLaunchedListener` callback. |

Each app owns its own `.env` at its root — there is no shared `example/.env`. Copy the template before running an app:

```bash
cp example/<app>/.env.example example/<app>/.env
```

Then fill in `EDOT_SERVER_URL`, `EDOT_SERVICE_NAME`, `EDOT_SECRET_TOKEN`, etc. Values are consumed via `react-native-dotenv` (`import ... from '@env'`). If `EDOT_SERVER_URL` is empty, each app surfaces a user-visible "Missing .env" message and skips SDK init without crashing.

To run an example (React Navigation):

```bash
cd example/react-navigation
yarn start               # Metro dev server
yarn ios                 # or: yarn android
```

## OpenSpec Change Workflow

Capability specs live in `openspec/specs/`. Non-trivial changes go through the OpenSpec proposal → design → tasks → implementation → archive cycle under `openspec/changes/`. Use the Claude Code skills:

- `/opsx:propose` — create a new change with all artifacts.
- `/opsx:apply` — implement tasks from an open change.
- `/opsx:verify` — verify implementation matches artifacts before archiving.
- `/opsx:archive` — move a completed change to `openspec/changes/archive/`.

For trivial fixes (typos, single-line bug fixes) skip OpenSpec and commit directly.

## Pre-commit Verification

Before every commit:

```bash
yarn typecheck
yarn lint
yarn test
```

Do not commit if any of these fail. For native changes, also build at least one example app (`cd example/react-navigation && yarn ios` or `yarn android`).

## Commit Messages

Conventional Commits style — `feat(sdk): ...`, `fix(android): ...`, `refactor(navigation): ...`, `chore(examples): ...`, `docs: ...`, `style: ...`, `build: ...`. Keep the subject under 72 characters and explain the WHY in the body when it isn't obvious from the diff.

## What Not to Do

- Don't add React Native dependencies to `@inox/react-native-edot-shared` — it must stay pure JS/TS so any package can import it without pulling in native code.
- Don't eagerly import `@inox/react-native-edot-sdk/nativeModule` at module top-level from navigation plugins — use lazy `require()` inside a function to break the circular dependency.
- Don't import `ActiveViewContext` from `@inox/react-native-edot-sdk` in navigation plugins — import from `@inox/react-native-edot-shared` directly.
- Don't manually construct `node_modules` paths in Metro config — rely on workspace resolution and `extraNodeModules`.
- Don't commit `lib/` or `src/**/*.js` build artifacts — they're gitignored.
- Don't use lowercase `object` in TurboModule specs — use capital `Object`. The RN codegen rejects `TSObjectKeyword`; capital `Object` maps to `GenericObjectTypeAnnotation`.
