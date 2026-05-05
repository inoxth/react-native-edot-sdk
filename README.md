# React Native EDOT SDK

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup.

Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase. React Native 0.75+, iOS 16+, Android minSdk 24.

## Get started

```bash
yarn add @inox/react-native-edot-sdk
```

```typescript
import { EdotReactNative } from '@inox/react-native-edot-sdk';

await EdotReactNative.initialize({
  serverUrl: 'https://your-apm-server:8200',
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
  secretToken: process.env.EDOT_SECRET_TOKEN,
});
```

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

Working example apps live in [`example/`](./example) — one each for `basic` (no navigation), React Navigation, Expo Router, and Wix react-native-navigation. Copy `.env.example` to `.env` in any app and fill in your EDOT server details to run.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and architecture entry points.

## License

MIT — see [LICENSE](./LICENSE).
