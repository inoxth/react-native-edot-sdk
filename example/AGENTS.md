# AGENTS.md — example/

## Overview

Four standalone demo apps showing SDK integration with different navigation frameworks. Each is a yarn workspace member with its own native project and Metro config.

## Apps

| App | Navigation | SDK Packages |
|---|---|---|
| `basic/` | None | sdk, tracer-provider |
| `react-navigation/` | React Navigation native-stack + bottom tabs | sdk, tracer-provider, navigation |
| `expo-router/` | Expo Router (file-based, root Stack + tabs) | sdk, tracer-provider, expo-router |
| `wix-navigation/` | Wix react-native-navigation (bottomTabs + push) | sdk, tracer-provider, wix-navigation |

## Shared Infrastructure

```
example/
├── .env                # Runtime config — copy from .env.example (git-ignored)
└── .env.example        # Template: EDOT_SERVER_URL, EDOT_SERVICE_NAME, EDOT_SECRET_TOKEN, etc.
```

## Platform Versions

All apps: RN 0.73.6, React 18.2.0, Hermes engine, min iOS 16.0, min Android SDK 24, compile/target SDK 34.

## SDK Initialization Pattern

All apps initialize in their entry point (`App.tsx` or `index.js`):

```js
await EdotReactNative.initialize({
  serverUrl: EDOT_SERVER_URL,
  serviceName: EDOT_SERVICE_NAME ?? 'edot-<app>-example',
  serviceVersion: EDOT_SERVICE_VERSION ?? '0.1.0',
  deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT ?? 'development',
  secretToken: EDOT_SECRET_TOKEN,
  debug: true,
});
```

Config values come from `.env` via `react-native-dotenv` (`@env` import).

## Metro Config Pattern

All apps share this monorepo Metro config pattern:

- `watchFolders`: monorepo root (for `@inox/*` packages)
- `extraNodeModules`: maps `@inox/*` package names to their `packages/*/` dirs
- Subpath exports resolved manually: `@inox/react-native-edot-sdk/nativeModule` and `/active-view-context`
- React singleton fix: `resolver.resolveRequest` ensures a single React instance
- expo-router uses `expo/metro-config` (mutates config); others use `@react-native/metro-config` (`mergeConfig`)

## iOS Native Setup

All Podfiles share: `platform :ios, '16.0'`, `use_native_modules!`, Flipper via `NO_FLIPPER` env var. EDOT SDK source files are included directly in Xcode targets (not as a Pod) — ElasticApm is an SPM dependency that pods cannot express.

## Android Native Setup

All apps: Gradle 8.3 (RN 0.73 default). EDOT Gradle plugin (`co.elastic.otel.android.agent`) intentionally not applied — requires Gradle 8.7+. React root set to `../../` for monorepo hoisted `node_modules`.

## Per-App Notes

| App | Key Difference |
|---|---|
| `basic/` | No navigation plugin — only SDK init + manual instrumentation. Single scrollable screen. |
| `react-navigation/` | Uses `createEdotNavigationContainerRef()` from `@inox/react-native-edot-navigation`. |
| `expo-router/` | Wraps layout in `<EdotExpoNavigationProvider>`. Requires `app.json` with `"scheme"` for deep linking. Podfile needs `use_expo_modules!`. AppDelegate adds `RCTLinkingManager` for URL handling. Uses `babel-preset-expo` (not `@react-native/babel-preset`). |
| `wix-navigation/` | Uses `registerEdotNavigationListener()` from `@inox/react-native-edot-wix-navigation`. AppDelegate extends `RNNAppDelegate` (not `RCTAppDelegate`) — RNN controls the root view controller. SDK init happens inside `registerAppLaunchedListener` callback. |
