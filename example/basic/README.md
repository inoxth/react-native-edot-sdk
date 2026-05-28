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

## Capturing errors

Once `useEdot(...)` resolves, uncaught JS errors and unhandled promise rejections are reported automatically. Wrap React subtrees with `EdotErrorBoundary` to also report render-time errors and show a fallback UI:

```tsx
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';

<EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
  <YourComponent />
</EdotErrorBoundary>
```

A live demo lives in [`src/sections/ErrorsSection.tsx`](./src/sections/ErrorsSection.tsx) — it triggers a JS error, a rejected promise, and a render crash inside an `EdotErrorBoundary`.

## Capturing logs

Use `EdotReactNative.log(severity, message, attributes?)` to send structured logs at any severity:

```ts
import { EdotReactNative } from '@inox/react-native-edot-sdk';

EdotReactNative.log('info', 'User signed in', { 'user.id': '42' });
EdotReactNative.log('warn', 'Slow network detected');
EdotReactNative.log('error', 'Payment failed', { 'error.code': '402' });
```

Severities: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Attribute values must be `string | number | boolean`. See [`src/sections/LogsSection.tsx`](./src/sections/LogsSection.tsx) for a working demo.

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
