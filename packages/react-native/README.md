# @inox/react-native-edot-sdk

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup. Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase.

## What you get

- **Network instrumentation** — automatic span creation for `fetch` and `XMLHttpRequest` (including Axios) with W3C trace context propagation
- **Error tracking** — captures uncaught JS exceptions, unhandled Promise rejections, and React render errors via `EdotErrorBoundary`
- **Startup tracing** — cold and warm start performance with JS bundle load and first render phases
- **App-state tracking** — foreground/background screen-lifetime spans with active-screen replay on resume
- **Lifecycle events** — emitted natively by the EDOT iOS/Android agents per the Elastic mobile agents spec
- **User interactions** — `withEdotTracking` HOC and `useEdotAction` hook for tap/action tracking
- **Manual instrumentation** — see [`@inox/react-native-edot-tracer-provider`](../react-native-tracer-provider) for custom spans and metrics
- **Navigation tracking** — see [`@inox/react-native-edot-navigation`](../react-native-navigation) for screen spans

## Install

```bash
yarn add @inox/react-native-edot-sdk
```

### iOS

```bash
cd ios && pod install
```

That's it. The SDK podspec declares the EDOT iOS agent (`apm-agent-ios`) as a Swift Package dependency via React Native's `spm_dependency` helper, so `pod install` resolves the package and links the `ElasticApm` product onto the SDK's pod target automatically. No manual Xcode SPM configuration is required.

Requires React Native 0.75+ and CocoaPods 1.13+. The SDK's native files are conditionally compiled against `ELASTIC_APM_AVAILABLE`, which the podspec enables on its own pod target whenever `spm_dependency` is in scope.

### Android

Apply the EDOT Android Gradle plugin — it provides the `co.elastic.otel.android` runtime the SDK links against.

`android/build.gradle` (project-level):

```groovy
buildscript {
  dependencies {
    classpath("co.elastic.otel.android.agent:co.elastic.otel.android.agent.gradle.plugin:1.5.0")
  }
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}
```

`android/app/build.gradle`:

```groovy
apply plugin: "co.elastic.otel.android.agent"
```

Requires Gradle 8.7+, AGP 8.9.1+, compileSdk 36, minSdk 24. See [`example/react-navigation/android/`](../../example/react-navigation/android) for a reference setup.

## Initialize

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

Auto-instrumentation for network, errors, and startup is enabled by default. Lifecycle events (`event.name="lifecycle"`, `event.domain="device"`) are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec.

## Configuration

`EdotReactNative.initialize(config)` accepts the following options. The full type is exported as `EdotConfig`.

### Required

| Option | Type | Description |
|---|---|---|
| `serverUrl` | `string` | EDOT / APM server URL |
| `serviceName` | `string` | Service name (no `,` or `=`) |
| `serviceVersion` | `string` | Service version (no `,` or `=`) |
| `deploymentEnvironment` | `string` | `production`, `staging`, etc. |

### Authentication (pick one)

| Option | Type | Description |
|---|---|---|
| `secretToken` | `string` | Secret token. Mutually exclusive with `apiKey`. |
| `apiKey` | `string` | API key. Mutually exclusive with `secretToken`. |

Both are wrapped in a redacted-string container immediately on receipt — `JSON.stringify(config)` will not leak them.

### Auto-instrumentation toggles

| Option | Type | Default | Description |
|---|---|---|---|
| `instrumentNetworkRequests` | `boolean` | `true` | `fetch` + XHR spans |
| `instrumentJsErrors` | `boolean` | `true` | Uncaught exceptions + unhandled rejections |
| `instrumentAppStartup` | `boolean` | `true` | Cold/warm start spans |
| `appStateTracking` | `boolean` | `true` | Foreground/background screen-lifetime spans |

### Network filtering

| Option | Type | Description |
|---|---|---|
| `tracePropagationTargets` | `(string \| RegExp)[]` | URLs to inject `traceparent` into. Defaults to none. |
| `ignoreUrls` | `(string \| RegExp)[]` | URLs to skip span creation for. |
| `graphqlUrls` | `(string \| RegExp)[]` | URLs treated as GraphQL endpoints (operation name parsed from body). |
| `urlSanitizer` | `(url: string) => string` | Strip secrets/PII from `http.url` before export. |

### Sampling & consent

| Option | Type | Description |
|---|---|---|
| `sessionSamplingRate` | `number` | `0.0`–`1.0`. Defaults to native agent's default. |
| `trackingConsent` | `'granted' \| 'pending' \| 'not_granted'` | JS-side emission gate. |

### Transport

| Option | Type | Description |
|---|---|---|
| `exportProtocol` | `'http' \| 'grpc'` | Defaults to `'grpc'` (matches apm-agent-ios trace/log default). |

### Attributes

| Option | Type | Description |
|---|---|---|
| `globalAttributes` | `Record<string, string \| number \| boolean>` | Attributes attached to every signal. |
| `userAttributes.includeInSpans` | `'all' \| 'id-only' \| 'none'` | How user identity propagates onto span attributes. Defaults to `'id-only'`. |

### iOS-only

Pass these under `ios: { … }` in the config:

| Option | Type | Description |
|---|---|---|
| `ios.enableCrashReporting` | `boolean` | Enable native crash reporting. |
| `ios.enableURLSessionInstrumentation` | `boolean` | Enable native `URLSession` HTTP spans. Off by default — JS-side fetch/XHR instrumentation is the canonical path. |
| `ios.enableViewControllerInstrumentation` | `boolean` | Enable `UIViewController` lifecycle spans. Off by default — JS navigation plugin is the canonical path. |
| `ios.enableAppMetricInstrumentation` | `boolean` | Enable native app metrics. Defaults to `true`. |
| `ios.enableSystemMetrics` | `boolean` | Enable native CPU / memory / battery metrics. Defaults to `true`. |
| `ios.enableLifecycleEvents` | `boolean` | Enable foreground/background/inactive/terminate lifecycle events. |
| `ios.useOpAMP` | `boolean` | Use OpAMP transport for central config. |

### Android-only

| Option | Type | Description |
|---|---|---|
| `android.diskBufferingEnabled` | `boolean` | Persist signals across process restarts. |

### Debug

| Option | Type | Description |
|---|---|---|
| `debug` | `boolean` | Enables `[EDOT]` console logs from the JS side. |

## Error boundary

Wrap your app to capture render errors as spans:

```tsx
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';
import { Text } from 'react-native';

export function App() {
  return (
    <EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
      <RootNavigator />
    </EdotErrorBoundary>
  );
}
```

Render errors are emitted as spans with `exception.type`, `exception.message`, and `exception.stacktrace` attributes.

## User interactions

### `withEdotTracking` HOC

```tsx
import { withEdotTracking } from '@inox/react-native-edot-sdk';
import { TouchableOpacity } from 'react-native';

const TrackedButton = withEdotTracking(TouchableOpacity, 'CheckoutButton');

// Renders normally; emits a tap action when pressed.
<TrackedButton onPress={handleCheckout}>...</TrackedButton>
```

### `useEdotAction` hook

```typescript
import { useEdotAction } from '@inox/react-native-edot-sdk';

function CheckoutScreen() {
  const { trackAction } = useEdotAction();

  function handlePurchase() {
    trackAction('tap', 'Purchase', { 'cart.items': 3 });
  }
}
```

## User & session APIs

```typescript
import { EdotReactNative } from '@inox/react-native-edot-sdk';

EdotReactNative.setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'Alice',
});
EdotReactNative.clearUser();

EdotReactNative.setSessionAttribute('subscription', 'premium');

EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
EdotReactNative.removeGlobalAttribute('tenant_id');

EdotReactNative.setTrackingConsent('granted');
```

`setGlobalAttribute` accepts `string | number | boolean` and is forwarded as a string on the native side.

## Structured logs

```typescript
EdotReactNative.log('info', 'Payment completed', { orderId: 'ord-456' });
EdotReactNative.log('error', 'Checkout failed', { reason: 'card_declined' });
```

Severity is one of `'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'`.

## Working example

[`example/basic/`](../../example/basic) — SDK init, manual tracing, metrics, logs, network, errors, interactions. No navigation.

## Requirements

- React Native >= 0.75 (required for the `spm_dependency` Cocoapods helper)
- iOS >= 16.0
- Android minSdk 24, compileSdk 36
- Node.js >= 18

## License

MIT — see [LICENSE](../../LICENSE).
