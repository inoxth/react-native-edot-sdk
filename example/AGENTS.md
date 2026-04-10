# AGENTS.md — example/

## Overview

Four standalone demo apps showing SDK integration with different navigation frameworks. Each is a yarn workspace member with its own native project, Metro config, and Detox E2E suite.

## Apps

| App | Navigation | E2E Tests |
|---|---|---|
| `basic/` | None (no navigation) | 25 tests |
| `react-navigation/` | React Navigation native-stack + bottom tabs | 11 tests |
| `expo-router/` | Expo Router (file-based, root Stack + tabs layout) | 31 tests |
| `wix-navigation/` | Wix react-native-navigation (bottomTabs + push) | 26 tests |

## Shared Infrastructure

```
example/
├── .detoxrc.js         # Shared Detox config template (each app has its own that extends or mirrors this)
├── .env                # Runtime config — copy from .env.example (git-ignored)
├── .env.example        # Template: EDOT_SERVER_URL, EDOT_SERVICE_NAME, EDOT_SECRET_TOKEN, etc.
└── artifacts/          # Detox screenshots/videos/logs on failure (git-ignored)
```

## E2E Testing

Each app has:
- `e2e/app.test.js` — Detox test suite
- `e2e/jest.config.js` — Jest config for Detox
- `.detoxrc.js` — App-specific Detox config (iOS simulator, iPhone 17 Pro, iOS 26.4)

```bash
# From inside each app directory:
yarn e2e:build    # xcodebuild Release iphonesimulator
yarn e2e:test     # detox test --configuration ios.sim.release
```

### E2E Patterns (iOS Simulator)

- All elements use `testID` props for targeting
- After native stack push/pop, wait before asserting: `await waitFor(element(by.id('...'))).toBeVisible().withTimeout(3000)`
- Back navigation helper (cross-platform):
  ```js
  async function navigateBack() {
    if (device.getPlatform() === 'ios') {
      await element(by.type('_UIButtonBarButton')).atIndex(0).tap();
    } else {
      await device.pressBack();
    }
  }
  ```
- `device.pressBack()` is Android-only — never use it directly on iOS

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
- `extraNodeModules`: maps `@inox/*` package names to their `src/` dirs
- React singleton fix: `resolver.resolveRequest` ensures a single React instance

## Per-App Notes

| App | Key Difference |
|---|---|
| `basic/` | No navigation plugin — only SDK init + manual instrumentation screens |
| `react-navigation/` | Uses `createEdotNavigationContainerRef()` from `@inox/react-native-edot-navigation` |
| `expo-router/` | Wraps layout in `<EdotExpoNavigationProvider>`. Requires `app.json` with `"scheme"` for standalone builds. Podfile needs `use_expo_modules!`. |
| `wix-navigation/` | Uses `registerEdotNavigationListener()` from `@inox/react-native-edot-wix-navigation`. AppDelegate extends `RNNAppDelegate` (not `RCTAppDelegate`) — RNN controls the root view controller. |
