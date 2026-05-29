# AGENTS.md — example/

## Overview

Four standalone demo apps showing SDK integration with different navigation frameworks. Each is a yarn workspace member with its own native project and Metro config.

## Apps

| App | Navigation | SDK Packages |
|---|---|---|
| `basic/` | None | sdk, tracer-provider |
| `react-navigation/` | React Navigation native-stack + bottom tabs | sdk, tracer-provider, navigation |
| `expo-router/` | Expo Router (file-based, root Stack + tabs) | sdk, tracer-provider, navigation |
| `wix-navigation/` | Wix react-native-navigation (bottomTabs + push) | sdk, tracer-provider, navigation |

## Runtime Config

Each app owns its own `.env` and `.env.example` at the app root — there is no shared
`example/.env`. Before running an app, copy its template:

```bash
cp example/<app>/.env.example example/<app>/.env
```

All four templates declare the same six vars: `EDOT_SERVER_URL`, `EDOT_SERVICE_NAME_IOS`,
`EDOT_SERVICE_NAME_ANDROID`, `EDOT_SERVICE_VERSION`, `EDOT_SECRET_TOKEN`,
`EDOT_DEPLOYMENT_ENVIRONMENT`. They are consumed via `react-native-dotenv`
(`import ... from '@env'`). If `EDOT_SERVER_URL` is empty, each app surfaces a user-visible
"Missing .env" message and skips SDK init without crashing the app.

## Architecture Coverage

Each app exposes scripts for both React Native architectures:

```bash
yarn ios            # New Arch (default)
yarn ios:old-arch   # Old Arch (RCT_NEW_ARCH_ENABLED=0)
yarn android        # New Arch (default)
yarn android:old-arch  # Old Arch (-PnewArchEnabled=false)
```

Both flows must succeed for any change that touches `packages/react-native/ios/` or `packages/react-native/android/`.

## Platform Versions

Hermes engine, min iOS 16.0, min Android SDK 24, compile/target SDK 36. RN versions vary by navigation library compatibility:

| App | RN | React |
|---|---|---|
| `basic/` | 0.85.1 | 19.2.3 |
| `react-navigation/` | 0.85.1 | 19.2.3 |
| `expo-router/` | 0.83.4 | 19.2.0 |
| `wix-navigation/` | 0.83.4 | 19.2.0 |

## SDK Initialization Pattern

All apps initialize in their entry point (`App.tsx` or `index.js`):

```js
await EdotReactNative.initialize({
  serverUrl: EDOT_SERVER_URL,
  ios: { serviceName: EDOT_SERVICE_NAME_IOS ?? 'edot-<app>-example-ios' },
  android: { serviceName: EDOT_SERVICE_NAME_ANDROID ?? 'edot-<app>-example-android' },
  serviceVersion: EDOT_SERVICE_VERSION ?? '0.1.0',
  deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT ?? 'development',
  secretToken: EDOT_SECRET_TOKEN,
  debug: true,
});
```

All four templates demonstrate the per-platform `serviceName` override — `EDOT_SERVICE_NAME_IOS` and `EDOT_SERVICE_NAME_ANDROID` are independent env vars, so each platform shows up as a distinct service in the APM service map. The previous combined `EDOT_SERVICE_NAME` env var is replaced by the two platform-specific ones.

Config values come from `.env` via `react-native-dotenv` (`@env` import).

## Metro Config Pattern

All apps share this monorepo Metro config pattern:

- `watchFolders`: monorepo root (for `@inoxth/*` packages)
- `extraNodeModules`: maps `@inoxth/*` package names to their `packages/*/` dirs
- Subpath exports resolved manually: `@inoxth/react-native-edot-sdk/nativeModule` and `/active-view-context`
- React singleton fix: `resolver.resolveRequest` ensures a single React instance
- expo-router uses `expo/metro-config` (mutates config); others use `@react-native/metro-config` (`mergeConfig`)

## iOS Native Setup

All Podfiles share: `platform :ios, '16.0'`, `use_native_modules!`. The EDOT SDK's root `packages/react-native/EdotReactNative.podspec` compiles its own Swift/Obj-C sources and declares the `apm-agent-ios` SPM dependency via React Native's top-level `spm_dependency` helper (RN 0.75+ — `installer.pods_project` is mutated in `post_install` by `SPMManager`). Example apps therefore have **no** EDOT source-file references, **no** `XCRemoteSwiftPackageReference`/`XCSwiftPackageProductDependency` entries, **no** `SWIFT_OBJC_BRIDGING_HEADER`, and **no** app-target `ELASTIC_APM_AVAILABLE` compilation condition in their `project.pbxproj` — `pod install` wires everything onto the EdotReactNative pod target. The wix-navigation and expo-router Podfiles include a `post_install` patch to disable `FMT_USE_CONSTEVAL` for Xcode 26 Apple clang compatibility.

## Android Native Setup

EDOT Gradle plugin (`co.elastic.otel.android.agent`) v1.5.0 applied in all apps. Requires AGP 8.9.1+, compileSdk 36, and Kotlin stdlib force-resolution to match the build's Kotlin version (prevents EDOT transitive deps from pulling incompatible versions). Monorepo root set to `../../../../` from `android/app/` (react root). Each app's `node_modules/` is local due to `hoistingLimits: "workspaces"`.

## Per-App Notes

| App | Key Difference |
|---|---|
| `basic/` | No navigation plugin — only SDK init + manual instrumentation. Single scrollable screen. |
| `react-navigation/` | Uses `useNavigationContainerRef()` from `@react-navigation/native` + `<EdotNavigationProvider navigationRef={…}>` from `@inoxth/react-native-edot-navigation`. Provider wraps `<NavigationContainer ref={ref}>`. |
| `expo-router/` | Uses `useNavigationContainerRef()` from `expo-router` + `<EdotNavigationProvider navigationRef={…}>` (same component as react-navigation). Requires `app.json` with `"scheme"` for deep linking. Podfile needs `use_expo_modules!`. AppDelegate adds `RCTLinkingManager` for URL handling. Uses `babel-preset-expo` (not `@react-native/babel-preset`). |
| `wix-navigation/` | Uses imperative `registerEdotNavigationListener(Navigation, …)` from `@inoxth/react-native-edot-navigation` (no React tree wrapper — Wix has no persistent React root). AppDelegate extends `RNNAppDelegate` (not `RCTAppDelegate`) — RNN controls the root view controller. SDK init + listener registration happen inside `registerAppLaunchedListener` callback, before `Navigation.setRoot(...)`. |
