# EDOT Expo Router Example

Example app demonstrating the EDOT React Native SDK with Expo Router navigation.

## Features

- Automatic view span tracking via `EdotExpoNavigationProvider`
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
  _layout.tsx           # Root layout — SDK init + EdotExpoNavigationProvider
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

## SDK Packages Used

- `@inox/react-native-edot-sdk` — Core SDK
- `@inox/react-native-edot-navigation` — Navigation tracking (covers Expo Router)
- `@inox/react-native-edot-tracer-provider` — Manual tracing and metrics
