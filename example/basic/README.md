# EDOT Basic Example

Bare React Native app demonstrating the EDOT SDK with **no navigation library** — every API is exercised in a single scrollable screen, so you can copy snippets straight out of the source.

## Setup

1. Copy the environment file and fill in your values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies from the monorepo root:

   ```bash
   yarn install
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

## How the SDK is wired up

Initialization lives in **[`src/App.tsx`](./src/App.tsx)**. To change the SDK config in your own app, edit the `useEdot({...})` call inside `InitializedApp`:

```tsx
import { EdotErrorBoundary, useEdot } from '@inox/react-native-edot-sdk';

function InitializedApp() {
  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID },
    serviceVersion: EDOT_SERVICE_VERSION,
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
    secretToken: EDOT_SECRET_TOKEN,
  });

  if (error) return <Text>Telemetry unavailable: {error.message}</Text>;
  if (!ready) return <ActivityIndicator />;

  return (
    <EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
      {/* sections live under src/sections/ */}
    </EdotErrorBoundary>
  );
}
```

Because there is no navigation library, `EdotNavigationProvider` is **not** used here. View-level spans must be emitted manually if you want them.

## What it demonstrates

Each section under [`src/sections/`](./src/sections/) is a self-contained example of one SDK surface:

- `StatusSection` — `EdotReactNative.getCurrentSessionId`
- `UserSection` — `setUser`, `clearUser`, `setSessionAttribute`, `setGlobalAttribute`, `removeGlobalAttribute`
- `NetworkSection` — auto-instrumented `fetch` / XHR
- `TracingSection` — `getTracerProvider().getTracer().startSpan()`, `withSpanContext`
- `MetricsSection` — `getMeterProvider()` with `createCounter`, `createHistogram`, `createUpDownCounter`
- `LogsSection` — `EdotReactNative.log` at every severity
- `InteractionSection` — `useEdotAction` hook and `withEdotTracking` HOC
- `ErrorsSection` — JS errors, promise rejections, `EdotErrorBoundary` crashes
