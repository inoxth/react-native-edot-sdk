# React Native EDOT SDK

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup.

Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase. React Native 0.75+, iOS 16+, Android minSdk 24.

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

iOS pod install + Android Gradle plugin setup, the full configuration reference, error boundary, interactions, and user/session APIs all live in **[`packages/react-native/README.md`](./packages/react-native/README.md)**.

## Packages

| Package | Description |
|---|---|
| [`@inoxth/react-native-edot-sdk`](./packages/react-native) | Core SDK — config, native bridge, auto-instrumentation, error boundary, user APIs |
| [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation) | Unified navigation tracking — React Navigation, Expo Router, Wix react-native-navigation |
| [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider) | Manual instrumentation API — custom spans and metrics |
| [`@inoxth/react-native-edot-cli`](./packages/cli) | Source map upload CLI |
| [`@inoxth/react-native-edot-shared`](./packages/shared) | Internal shared state — do not depend on directly |

## Features

Each row links to the package that provides the API. Features marked **Auto** are wired up by `initialize` / `useEdot` with no extra code; **Manual** features require calling an API.

| Feature | Mode | Package |
|---|---|---|
| `fetch` and `XMLHttpRequest` tracing (HTTP client spans with `traceparent` propagation) | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| GraphQL operation naming on network spans (`graphql.operation.{type,name}`) | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Uncaught JS errors and unhandled promise rejections | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| App startup spans (`app.startup.{duration,js_bundle_load,first_render}_ms`) | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| App background/foreground tracking (aborts in-flight screen spans) | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Native crash reporting, system CPU/memory, app launch time | Auto | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Screen / view spans for React Navigation and Expo Router (`screen.name`, `last.screen.name`) | Auto | [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation/README.md) |
| Screen / view spans for Wix `react-native-navigation` | Auto | [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation/README.md) |
| React render errors via `EdotErrorBoundary` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| User identity — `setUser` / `clearUser` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Session ID + session attributes — `getCurrentSessionId`, `setSessionAttribute` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Global attributes — `setGlobalAttribute`, `removeGlobalAttribute` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Structured logs — `EdotReactNative.log(severity, message, attributes?)` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| User actions — `addAction`, `useEdotAction`, `withEdotTracking` | Manual | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Manual screen-load signalling — `useScreenLoaded`, `markCurrentScreenLoaded` | Manual | [`@inoxth/react-native-edot-navigation`](./packages/react-native-navigation/README.md) |
| Manual tracing — `getTracerProvider`, `startSpan`, `withSpanContext`, `recordException` | Manual | [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md) |
| Manual metrics — `Counter`, `Histogram`, `UpDownCounter` via `getMeterProvider` | Manual | [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md) |

### Trackable attributes

| Scope | API | Value types | Package |
|---|---|---|---|
| User | `setUser({ id, email?, name? })`, `clearUser()` | `string` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Session | `setSessionAttribute(key, value)` | `string` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Global (runtime) | `setGlobalAttribute(key, value)`, `removeGlobalAttribute(key)` | `string \| number \| boolean` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Global (init-time) | `EdotConfig.globalAttributes` | `string \| number \| boolean` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Log | 3rd arg of `EdotReactNative.log(severity, message, attributes?)` | `string \| number \| boolean` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| User action | 3rd arg of `addAction(type, name, attributes?)` / `trackAction(...)` | `string \| number \| boolean` | [`@inoxth/react-native-edot-sdk`](./packages/react-native/README.md) |
| Span (manual) | `span.setAttribute(key, value)`, `startSpan(name, { attributes })` | `string \| number \| boolean` | [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md) |
| Metric | 2nd arg of `counter.add(value, attributes?)`, `histogram.record(...)`, `upDown.add(...)` | `string` | [`@inoxth/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider/README.md) |

User attribute propagation onto spans is controlled by `EdotConfig.userAttributes.includeInSpans` (`'all' \| 'id-only' \| 'none'`, default `'id-only'`).

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
