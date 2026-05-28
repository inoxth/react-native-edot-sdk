# EDOT React Native SDK — Example Apps

Each subdirectory is a standalone yarn workspace demo app. Pick the one matching the navigation library you use.

## Apps

| App | Navigation | Integration |
|---|---|---|
| [`basic/`](./basic) | None | `useEdot` hook only — single scrollable screen demonstrating tracing, metrics, logs, user APIs, and `EdotErrorBoundary`. |
| [`react-navigation/`](./react-navigation) | React Navigation (native stack + bottom tabs) | `useEdot` + `<EdotNavigationProvider>` wrapping `<NavigationContainer>`. |
| [`expo-router/`](./expo-router) | Expo Router (file-based) | `useEdot` + `<EdotNavigationProvider>` wrapping `<Stack>` in `app/_layout.tsx`. |
| [`wix-navigation/`](./wix-navigation) | Wix [`react-native-navigation`](https://github.com/wix/react-native-navigation) | Imperative `EdotReactNative.initialize` + `registerEdotNavigationListener` in `index.js`. |

## Common setup

1. Copy the chosen app's `.env.example` to `.env` and fill in your APM server details:

   ```bash
   cp example/<app>/.env.example example/<app>/.env
   ```

   Variables: `EDOT_SERVER_URL`, `EDOT_SERVICE_NAME_IOS`, `EDOT_SERVICE_NAME_ANDROID`, `EDOT_SERVICE_VERSION`, `EDOT_SECRET_TOKEN`, `EDOT_DEPLOYMENT_ENVIRONMENT`. If `EDOT_SERVER_URL` is empty the app surfaces a "Missing .env" message and skips SDK init without crashing.

2. Install dependencies from the monorepo root:

   ```bash
   yarn install
   ```

3. Follow the per-app README for `pod install` (iOS) and `yarn ios` / `yarn android` instructions — scripts vary slightly (`expo-router` uses Expo CLI; others use the React Native CLI).

## Further reading

- Root [`README.md`](../README.md) — SDK overview and package list.
- [`packages/react-native/README.md`](../packages/react-native/README.md) — full `EdotConfig` reference, error boundary, interactions, user/session APIs.
- [`AGENTS.md`](./AGENTS.md) — contributor notes (Metro, Podfile, Gradle, architecture coverage).
