# EDOT Wix Navigation Example

Example React Native app using [Wix react-native-navigation](https://github.com/wix/react-native-navigation) with the React Native EDOT SDK.

## Setup

1. Copy `.env.example` to `.env` and fill in your APM server details:

```bash
cp .env.example .env
```

2. Install dependencies from the monorepo root:

```bash
cd ../..
yarn install
```

3. Run the app:

```bash
# iOS
yarn ios

# Android
yarn android
```

## Features

- **Home** -- SDK status, session ID, user/session/global attributes
- **Demos** -- Network requests, manual tracing, metrics, structured logs, error tracking
- **Settings** -- Display current `.env` configuration

## How the SDK is wired up

Wix `react-native-navigation` owns the root view controller and there is no persistent React root — so the React-only `useEdot` hook does not apply. Initialization and navigation tracking both live in **[`index.js`](./index.js)** inside the `registerAppLaunchedListener` callback, **in this order**:

```js
import { Navigation } from 'react-native-navigation';
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';
import { registerEdotNavigationListener } from '@inoxth/react-native-edot-navigation';

const SCREEN_NAME_MAP = {
  HomeScreen: 'Home',
  DemosScreen: 'Demos',
  SettingsScreen: 'Settings',
  NetworkDemo: 'Network',
  TracingDemo: 'Tracing',
  MetricsDemo: 'Metrics',
  LogsDemo: 'Logs',
  ErrorDemo: 'Errors',
  InteractionDemo: 'Interaction',
};

Navigation.events().registerAppLaunchedListener(async () => {
  await EdotReactNative.initialize({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID },
    serviceVersion: EDOT_SERVICE_VERSION,
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
    secretToken: EDOT_SECRET_TOKEN,
  });

  registerEdotNavigationListener(Navigation, {
    screenNameMapper: (name) => SCREEN_NAME_MAP[name] ?? name,
  });

  Navigation.setRoot({ /* bottomTabs ... */ });
});
```

To customize:

- **SDK config** — edit the `EdotReactNative.initialize({...})` call.
- **Screen names** — edit `SCREEN_NAME_MAP` to translate registered component names into human-readable screen names. Wix `screenNameMapper` receives the component name passed to `Navigation.registerComponent(...)`, not a route path — so the mapping is a static lookup table rather than a regex.
- **Order matters**: `await initialize(...)` must finish before `Navigation.setRoot(...)`, otherwise the first screen's view span is dropped while the native tracer is still the OpenTelemetry no-op default.

## Capturing errors

Once `EdotReactNative.initialize(...)` resolves, uncaught JS errors and unhandled promise rejections are reported automatically. Wrap React subtrees with `EdotErrorBoundary` to also report render-time errors and show a fallback UI:

```jsx
import { EdotErrorBoundary } from '@inoxth/react-native-edot-sdk';

<EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
  <YourScreen />
</EdotErrorBoundary>
```

See [`src/screens/ErrorDemo.tsx`](./src/screens/ErrorDemo.tsx) for a working demo (JS error, rejected promise, and an `EdotErrorBoundary` render crash).

## Capturing logs

Use `EdotReactNative.log(severity, message, attributes?)` to send structured logs at any severity:

```js
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';

EdotReactNative.log('info', 'User signed in', { 'user.id': '42' });
EdotReactNative.log('warn', 'Slow network detected');
EdotReactNative.log('error', 'Payment failed', { 'error.code': '402' });
```

Severities: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Attribute values must be `string | number | boolean`. See [`src/screens/LogsDemo.tsx`](./src/screens/LogsDemo.tsx) for a working demo.
