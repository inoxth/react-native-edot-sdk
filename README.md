# React Native EDOT SDK

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup.

Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase. React Native 0.75+, iOS 16+, Android minSdk 24.

## Get started

```bash
yarn add @inox/react-native-edot-sdk
```

```tsx
import { useEdot } from '@inox/react-native-edot-sdk';

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
| [`@inox/react-native-edot-sdk`](./packages/react-native) | Core SDK — config, native bridge, auto-instrumentation, error boundary, user APIs |
| [`@inox/react-native-edot-navigation`](./packages/react-native-navigation) | Unified navigation tracking — React Navigation, Expo Router, Wix react-native-navigation |
| [`@inox/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider) | Manual instrumentation API — custom spans and metrics |
| [`@inox/react-native-edot-cli`](./packages/cli) | Source map upload CLI |
| [`@inox/react-native-edot-shared`](./packages/shared) | Internal shared state — do not depend on directly |

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
