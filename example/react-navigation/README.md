# EDOT React Navigation Example

Demonstrates the React Native EDOT SDK with React Navigation, including automatic navigation tracking, manual tracing, metrics, logs, and error handling.

## Setup

1. Install dependencies from the monorepo root:

```bash
yarn install
```

2. Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

3. Install iOS pods (macOS only):

```bash
cd ios && pod install && cd ..
```

4. Run the app:

```bash
# iOS
yarn ios

# Android
yarn android
```

## Initialization Pattern

SDK initialization is async. `<NavigationContainer>` must wait for it to finish before mounting — otherwise its `onReady` fires while the iOS native module's tracer is still the OpenTelemetry default no-op provider, and the **initial** screen span (e.g. `Home` on cold start) is silently dropped. See `src/App.tsx`: the `useEdot(...)` hook exposes `{ ready, error }`, and `InitializedApp` gates the `<NavigationContainer>` render on `ready === true`.

## How the SDK is wired up

Both initialization and navigation tracking live in **[`src/App.tsx`](./src/App.tsx)** (`InitializedApp`). Two pieces, in order:

```tsx
import { useEdot } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';

function screenNameMapper(routeName: string): string {
  return routeName.replace(/\/\d+/g, '/:id');
}

function InitializedApp() {
  const navigationRef = useNavigationContainerRef();
  
  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID },
    serviceVersion: EDOT_SERVICE_VERSION,
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
    secretToken: EDOT_SECRET_TOKEN,
  });

  if (!ready) return <></>;

  return (
    <EdotNavigationProvider navigationRef={navigationRef} screenNameMapper={screenNameMapper}>
      <NavigationContainer ref={navigationRef}>
        {/* tabs + stacks */}
      </NavigationContainer>
    </EdotNavigationProvider>
  );
}
```

To customize:

- **SDK config** — edit the `useEdot({...})` call.
- **Screen names** — edit `screenNameMapper`. The example collapses numeric IDs so dynamic routes group correctly in the APM service map: `/users/123/posts/45` becomes `/users/:id/posts/:id`.
- The `navigationRef` from `useNavigationContainerRef()` must be passed to **both** `EdotNavigationProvider` and `NavigationContainer`.

## Screens

- **Home** - SDK status, session info, user/attribute management
- **Demos** - Navigation hub to demo screens:
  - **Network** - Auto-instrumented fetch and XHR requests
  - **Tracing** - Manual span creation with parent/child relationships
  - **Metrics** - Counter, Histogram, and UpDownCounter demos
  - **Logs** - Structured log emission at different severity levels
  - **Errors** - JS errors, promise rejections, ErrorBoundary crashes
- **Settings** - Current .env configuration display
