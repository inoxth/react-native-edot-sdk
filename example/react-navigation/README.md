# EDOT React Navigation Example

Demonstrates the EDOT React Native SDK with React Navigation, including automatic navigation tracking, manual tracing, metrics, logs, and error handling.

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

`EdotReactNative.initialize(...)` is async. `<NavigationContainer>` must wait for it to resolve before mounting — otherwise its `onReady` fires while the iOS native module's tracer is still the OpenTelemetry default no-op provider, and the **initial** screen span (e.g. `Home` on cold start) is silently dropped. See `src/App.tsx`: an `sdkReady` state flips after `initialize(...)` resolves and gates the `<NavigationContainer>` render.

## Screens

- **Home** - SDK status, session info, user/attribute management
- **Demos** - Navigation hub to demo screens:
  - **Network** - Auto-instrumented fetch and XHR requests
  - **Tracing** - Manual span creation with parent/child relationships
  - **Metrics** - Counter, Histogram, and UpDownCounter demos
  - **Logs** - Structured log emission at different severity levels
  - **Errors** - JS errors, promise rejections, ErrorBoundary crashes
- **Settings** - Current .env configuration display
