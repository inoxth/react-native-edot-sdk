# @inox/react-native-edot-navigation

Unified navigation tracking plugin for the EDOT React Native SDK. Emits a screen-lifetime span on every navigation, enriches network/error spans with `screen.name` + `screen.id`, and replays the active screen on app foreground.

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

Initialize the SDK once at app startup, then wrap your `NavigationContainer` with `<EdotNavigationProvider>` sharing the same ref:

```tsx
import { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';

export function App() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        await EdotReactNative.initialize({
          serverUrl: 'https://your-apm-server:8200',
          serviceName: 'my-app',
          serviceVersion: '1.0.0',
          deploymentEnvironment: 'production',
          secretToken: process.env.EDOT_SECRET_TOKEN,
        });
      } catch (err) {
        console.error('[EDOT] Init failed:', err);
      }
    }
    init();
  }, []);

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

Expo Router is built on top of React Navigation and exposes the same `useNavigationContainerRef` hook. Initialize the SDK from your root layout:

```tsx
import { useEffect } from 'react';
import { Slot, useNavigationContainerRef } from 'expo-router';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        await EdotReactNative.initialize({
          serverUrl: 'https://your-apm-server:8200',
          serviceName: 'my-app',
          serviceVersion: '1.0.0',
          deploymentEnvironment: 'production',
          secretToken: process.env.EDOT_SECRET_TOKEN,
        })
      } catch (err) {
        console.error('[EDOT] Init failed:', err);
      }
    }
    init();
  }, []);

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

For every navigation, a span is created with:

- name = the (post-mapper) screen name
- kind = `INTERNAL`
- attribute `screen.name`
- attribute `last.screen.name` (only when a previous screen exists and differs)

Network and error spans created while the screen is active automatically include `screen.name` and `screen.id` as well.

When the app returns from background, the active screen is re-emitted as a fresh visit (so `last.screen.name` is omitted) — see the SDK's `appStateTracking` config for details.

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
