# EDOT Expo Router Example

Example app demonstrating the React Native EDOT SDK with Expo Router navigation.

## Features

- Automatic view span tracking via `EdotNavigationProvider`
- Screen name mapping (strips numeric IDs from paths)
- Bottom tab navigation (Home, Demos, Settings)
- Demo screens for network requests, tracing, metrics, logs, and error tracking

## Setup

1. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

2. Install dependencies from the monorepo root:

```bash
cd ../..
yarn install
```

3. Start the development server:

```bash
cd example/expo-router
yarn start
```

4. Run on a simulator:

```bash
yarn ios
# or
yarn android
```

## Project Structure

```
app/
  _layout.tsx           # Root layout — SDK init + EdotNavigationProvider
  (tabs)/
    _layout.tsx         # Tab bar layout (Home, Demos, Settings)
    index.tsx           # Home — SDK status, session, attributes
    demos.tsx           # Links to demo screens
    settings.tsx        # Display .env config
  demos/
    network.tsx         # Fetch/XHR demo (auto-instrumented)
    tracing.tsx         # Manual spans with getTracerProvider
    metrics.tsx         # Counter, Histogram, UpDownCounter
    logs.tsx            # Structured log messages
    errors.tsx          # Error tracking and ErrorBoundary
```

## How the SDK is wired up

Initialization and navigation tracking both live in **[`app/_layout.tsx`](./app/_layout.tsx)** (`InitializedLayout`). Expo Router exposes its own `useNavigationContainerRef`, so the integration mirrors the React Navigation example but the import path differs:

```tsx
import { Stack, useNavigationContainerRef } from 'expo-router';
import { useEdot } from '@inoxth/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inoxth/react-native-edot-navigation';

function screenNameMapper(routeName: string): string {
  return routeName;
}

function InitializedLayout() {
  const navigationRef = useNavigationContainerRef();
  
  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID },
    serviceVersion: EDOT_SERVICE_VERSION,
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
    secretToken: EDOT_SECRET_TOKEN,
  });

  return (
    <EdotNavigationProvider navigationRef={navigationRef} screenNameMapper={screenNameMapper}>
      <Stack screenOptions={{ title: ready ? 'EDOT Expo Router' : 'Initializing...' }} />
    </EdotNavigationProvider>
  );
}
```

To customize:

- **SDK config** — edit the `useEdot({...})` call.
- **Route name mapping** — edit `screenNameMapper`. The example passes route names through unchanged; override here to collapse dynamic segments. For instance, to normalize `/posts/[id]`:

  ```ts
  function screenNameMapper(routeName: string): string {
    return routeName.replace(/\/\d+/g, '/:id');
  }
  ```

- Import `useNavigationContainerRef` from **`expo-router`**, not from `@react-navigation/native`, even though the `EdotNavigationProvider` component is the same.

## Capturing errors

Once `useEdot(...)` resolves, uncaught JS errors and unhandled promise rejections are reported automatically. Wrap React subtrees with `EdotErrorBoundary` to also report render-time errors and show a fallback UI:

```tsx
import { EdotErrorBoundary } from '@inoxth/react-native-edot-sdk';

<EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
  <YourComponent />
</EdotErrorBoundary>
```

See [`app/demos/errors.tsx`](./app/demos/errors.tsx) for a working demo (JS error, rejected promise, and an `EdotErrorBoundary` render crash).

## Capturing logs

Use `EdotReactNative.log(severity, message, attributes?)` to send structured logs at any severity:

```ts
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';

EdotReactNative.log('info', 'User signed in', { 'user.id': '42' });
EdotReactNative.log('warn', 'Slow network detected');
EdotReactNative.log('error', 'Payment failed', { 'error.code': '402' });
```

Severities: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Attribute values must be `string | number | boolean`. See [`app/demos/logs.tsx`](./app/demos/logs.tsx) for a working demo.

## SDK Packages Used

- `@inoxth/react-native-edot-sdk` — Core SDK
- `@inoxth/react-native-edot-navigation` — Navigation tracking (covers Expo Router)
- `@inoxth/react-native-edot-tracer-provider` — Manual tracing and metrics
