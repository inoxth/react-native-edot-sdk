# React Native EDOT SDK

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup.

Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase. React Native 0.75+, iOS 15.6+, Android minSdk 24.

## Get started

```bash
yarn add @inoxth/react-native-edot-sdk
```

```tsx
import { useEdot } from '@inoxth/react-native-edot-sdk';

export function App() {
  const { ready, error } = useEdot({
    serverUrl: 'https://your-apm-server:8200',
    serviceName: 'my-app',
    serviceVersion: '1.0.0',
    deploymentEnvironment: 'production',
    secretToken: process.env.EDOT_SECRET_TOKEN,
  });

  if (error) {
    return <Text>Telemetry unavailable: {error.message}</Text>;
  }
  
  if (!ready) {
    return <ActivityIndicator />;
  }

  return <RootNavigator />;
}
```

`useEdot` calls `initialize` once on mount and returns reactive `{ ready, error }` state. For non-React contexts, the imperative `EdotReactNative.initialize(config)` is also available.

iOS pod install + Android Gradle plugin setup, the full configuration reference, error boundary, and interactions all live in **[`packages/react-native/README.md`](./packages/react-native/README.md)**.

## Packages

| Package | Description |
|---|---|
| [`@inoxth/react-native-edot-sdk`](./packages/react-native) | Core SDK — config, native bridge, auto-instrumentation, error boundary |
| [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation) | Unified navigation tracking — React Navigation, Expo Router, Wix react-native-navigation |
| [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider) | Manual instrumentation API — custom spans and metrics |
| [`@inoxth/react-native-edot-cli`](./packages/cli) | Source map upload CLI |
| [`@inoxth/react-native-edot-shared`](./packages/shared) | Internal shared state — do not depend on directly |

## Compatibility

| `@inoxth/react-native-edot-sdk` | EDOT iOS (`apm-agent-ios`) | EDOT Android (`co.elastic.otel.android:agent-sdk`) | Min iOS | Min Android |
|---|---|---|---|---|
| **0.2.x** | 1.2.1 | 1.1.0 | 15.6 | 24 |

All versions require React Native ≥ 0.75 (for the `spm_dependency` CocoaPods helper).

## Features

Features marked **Auto** are wired up by `initialize` / `useEdot` with no extra code; **Manual** features require calling an API. Grouped by the package that provides them.

### Core SDK — [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md)

| Feature | Mode |
|---|---|
| `fetch` and `XMLHttpRequest` tracing (HTTP client spans with `traceparent` propagation) | Auto |
| GraphQL operation naming on network spans (`graphql.operation.{type,name}`) | Auto |
| Uncaught JS errors and unhandled promise rejections | Auto |
| App startup spans (`app.startup.{duration,js_bundle_load,first_render}_ms`) | Auto |
| App background/foreground tracking (aborts in-flight screen spans) | Auto |
| Native crash reporting, system CPU/memory, app launch time | Auto |
| React render errors via `EdotErrorBoundary` | Manual |
| Session ID — `getCurrentSessionId` | Manual |
| Structured logs — `EdotReactNative.log(severity, message, attributes?)` | Manual |
| User actions — `addAction`, `useEdotAction`, `withEdotTracking` | Manual |

### Navigation — [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation/README.md)

| Feature | Mode |
|---|---|
| Screen / view spans for React Navigation and Expo Router (`screen.name`, `last.screen.name`) | Auto |
| Screen / view spans for Wix `react-native-navigation` | Auto |
| Manual screen-load signalling — `useScreenLoaded`, `markCurrentScreenLoaded` | Manual |

### Tracer provider — [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md)

| Feature | Mode |
|---|---|
| Manual tracing — `getTracerProvider`, `startSpan`, `withSpanContext`, `recordException` | Manual |
| Manual metrics — `Counter`, `Histogram`, `UpDownCounter` via `getMeterProvider` | Manual |

### Trackable attributes

Attribute value types accepted by each API, grouped by package.

**Core SDK** — [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md)

| Scope | API | Value types |
|---|---|---|
| Log | 3rd arg of `EdotReactNative.log(severity, message, attributes?)` | `string \| number \| boolean` |
| User action | 3rd arg of `addAction(type, name, attributes?)` / `trackAction(...)` | `string \| number \| boolean` |

**Tracer provider** — [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md)

| Scope | API | Value types |
|---|---|---|
| Span (manual) | `span.setAttribute(key, value)`, `startSpan(name, { attributes })` | `string \| number \| boolean` |
| Metric | 2nd arg of `counter.add(value, attributes?)`, `histogram.record(...)`, `upDown.add(...)` | `string` |

## Examples

Working example apps live in [`example/`](./example) — one per navigation library. Copy each app's `.env.example` to `.env` and fill in your EDOT server details, then run from the app directory.

- [`example/basic`](./example/basic) — Bare React Native, no navigation library. SDK init plus manual tracing, metrics, and logs in a single screen.
- [`example/react-navigation`](./example/react-navigation) — React Navigation (native stack + bottom tabs) with automatic screen tracking via `EdotNavigationProvider`.
- [`example/expo-router`](./example/expo-router) — Expo Router (file-based routing) with the same `EdotNavigationProvider` integration.
- [`example/wix-navigation`](./example/wix-navigation) — Wix `react-native-navigation` with the imperative `registerEdotNavigationListener` integration.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and architecture entry points.

## License

MIT — see [LICENSE](./LICENSE).
