# @inox/react-native-edot-navigation

Unified navigation tracking plugin for the React Native EDOT SDK. On every navigation it emits a **screen-load-latency** span (from screen-appear until the JS thread is idle, i.e. the screen is interactive) and enriches network/error spans created during that screen's lifetime with `screen.name` + `screen.id`.

A single package covers all three popular React Native navigators:

- [@inox/react-native-edot-navigation](#inoxreact-native-edot-navigation)
  - [Install](#install)
  - [React Navigation](#react-navigation)
  - [Expo Router](#expo-router)
  - [Wix react-native-navigation](#wix-react-native-navigation)
  - [Screen name mapping](#screen-name-mapping)
  - [What gets emitted](#what-gets-emitted)
  - [Requirements](#requirements)
  - [License](#license)

Pick the section that matches your navigator — each is self-contained.

## Install

```bash
yarn add @inox/react-native-edot-navigation
```

You also need the core SDK initialized first:

```bash
yarn add @inox/react-native-edot-sdk
```

See the [SDK README](../react-native) for native setup and `EdotReactNative.initialize(...)`. The navigator libraries themselves are declared as **optional** peer dependencies — only install the one you actually use.

## React Navigation

```bash
yarn add @react-navigation/native
```

Initialize the SDK with `useEdot` at the app root, then wrap your `NavigationContainer` with `<EdotNavigationProvider>` sharing the same ref. **Wait for `ready` before mounting `NavigationContainer`** — the navigator emits its initial screen span synchronously on mount, and on iOS the OTel TracerProvider only points at the agent's exporter once the agent has started. Mounting before the SDK is ready silently drops the first screen span.

```tsx
import { ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useEdot } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';

export function App() {
  const navigationRef = useNavigationContainerRef();
  const { ready, error } = useEdot({
    serverUrl: 'https://your-apm-server:8200',
    serviceName: 'my-app',
    serviceVersion: '1.0.0',
    deploymentEnvironment: 'production',
    secretToken: process.env.EDOT_SECRET_TOKEN,
  });

  if (error) return <Text>Telemetry unavailable: {error.message}</Text>;
  if (!ready) return <ActivityIndicator />;

  return (
    <NavigationContainer ref={navigationRef}>
      <EdotNavigationProvider navigationRef={navigationRef}>
        {/* your screens */}
      </EdotNavigationProvider>
    </NavigationContainer>
  );
}
```

Working example: [`example/react-navigation/`](../../example/react-navigation).

## Expo Router

Expo Router is built on top of React Navigation and exposes the same `useNavigationContainerRef` hook. Initialize the SDK from your root layout with `useEdot` and gate the navigator on `ready` — the same first-screen-span ordering rule from the React Navigation section applies here:

```tsx
import { ActivityIndicator, Text } from 'react-native';
import { Slot, useNavigationContainerRef } from 'expo-router';
import { useEdot } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const { ready, error } = useEdot({
    serverUrl: 'https://your-apm-server:8200',
    serviceName: 'my-app',
    serviceVersion: '1.0.0',
    deploymentEnvironment: 'production',
    secretToken: process.env.EDOT_SECRET_TOKEN,
  });

  if (error) return <Text>Telemetry unavailable: {error.message}</Text>;
  if (!ready) return <ActivityIndicator />;

  return (
    <EdotNavigationProvider
      navigationRef={navigationRef}
      screenNameMapper={(name) => name.replace(/\/\d+/g, '/:id')}
    >
      <Slot />
    </EdotNavigationProvider>
  );
}
```

Working example: [`example/expo-router/`](../../example/expo-router).

## Wix react-native-navigation

> Wix cannot use the `useEdot` hook. Init has to run inside `Navigation.events().registerAppLaunchedListener` — that's a callback executed by the native navigator before any React component mounts, so there is no React tree yet. Use the imperative `EdotReactNative.initialize(config)` here.

Wix has no continuously-mounted React root, so registration is imperative and the order matters. Do this in your `index.js`:

1. Register every screen component at module top level (synchronous, before the navigator boots).
2. Inside `registerAppLaunchedListener`, initialize the SDK first.
3. Then call `registerEdotNavigationListener` so subsequent navigations are tracked.
4. Then call `Navigation.setRoot(...)` to mount the UI.

```typescript
import { Navigation } from 'react-native-navigation';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { registerEdotNavigationListener } from '@inox/react-native-edot-navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { DemosScreen } from './src/screens/DemosScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// 1. Register screens at module top level
Navigation.registerComponent('HomeScreen', () => HomeScreen);
Navigation.registerComponent('DemosScreen', () => DemosScreen);
Navigation.registerComponent('SettingsScreen', () => SettingsScreen);

const SCREEN_NAME_MAP: Record<string, string> = {
  HomeScreen: 'Home',
  DemosScreen: 'Demos',
  SettingsScreen: 'Settings',
};

Navigation.events().registerAppLaunchedListener(async () => {
  // 2. Initialize the SDK first
  await EdotReactNative.initialize({
    serverUrl: 'https://your-apm-server:8200',
    serviceName: 'my-app',
    serviceVersion: '1.0.0',
    deploymentEnvironment: 'production',
    secretToken: process.env.EDOT_SECRET_TOKEN,
  });

  // 3. Hook the navigation listener
  registerEdotNavigationListener(Navigation, {
    screenNameMapper: (name) => SCREEN_NAME_MAP[name] ?? name,
  });

  // 4. Mount the UI
  Navigation.setRoot({
    root: {
      bottomTabs: {
        children: [
          { stack: { children: [{ component: { name: 'HomeScreen' } }] } },
          { stack: { children: [{ component: { name: 'DemosScreen' } }] } },
          { stack: { children: [{ component: { name: 'SettingsScreen' } }] } },
        ],
      },
    },
  });
});
```

`registerEdotNavigationListener` returns a cleanup function — call it in tests or when tearing down the navigator.

Working example: [`example/wix-navigation/`](../../example/wix-navigation).

## Screen name mapping

Both surfaces accept a `screenNameMapper` to normalize raw route names into stable span names. Common uses:

```typescript
// Strip dynamic ids out of expo-router pathnames
screenNameMapper: (name) => name.replace(/\/\d+/g, '/:id');

// Use a friendly display name based on params
screenNameMapper: (name, params) =>
  name === 'Profile' && typeof params?.tab === 'string' ? `Profile.${params.tab}` : name;
```

## What gets emitted

For every navigation, a screen-load-latency span is created with:

- name = `<post-mapper screen name> - view appearing` (matches EDOT iOS/Android view-appearing span naming)
- kind = `INTERNAL`
- attribute `screen.name` (the bare post-mapper screen name)
- attribute `last.screen.name` (only when a previous screen exists and differs)

The span starts when the screen appears and **ends automatically when `InteractionManager.runAfterInteractions` fires** — i.e. when navigation/transition animations have finished and the JS thread is idle. Typical span durations are 100–500ms, suitable for a Latency SLO.

Network and error spans created while the screen is active automatically include `screen.name` and `screen.id` as well — that correlation continues for the full time the screen is the active view, even after the load-latency span has already ended.

If the app is sent to background while the load span is still running (rare, only during the brief load window), the span is closed with status `ERROR` and attribute `screen.load.aborted=true` so SLOs see the abort honestly.

### Custom load completion signal

For screens that need to wait for async data (e.g. an initial fetch) before they're truly "interactive", use `useScreenLoaded(ready)` to override the default `runAfterInteractions` end-trigger:

```tsx
import { useScreenLoaded } from '@inox/react-native-edot-navigation';

function ProductScreen() {
  const { data } = useQuery('/product');
  useScreenLoaded(!!data); // ends the load span as soon as data arrives
  return /* ... */;
}
```

Whichever fires first — your `useScreenLoaded` flip or the automatic `runAfterInteractions` — wins; the span ends only once. Imperative callers can use `markCurrentScreenLoaded()` directly.

## Requirements

- React Native >= 0.72.0
- React >= 18.0.0
- One of:
  - `@react-navigation/native` >= 6.0.0
  - `expo-router` >= 3.0.0
  - `react-native-navigation` >= 7.0.0
- [`@inox/react-native-edot-sdk`](../react-native) initialized at app startup

## License

MIT — see [LICENSE](../../LICENSE).
