# @inoxth/react-native-edot-sdk

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup. Supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) from a single codebase.

## What you get

- **React init hook** — `useEdot(config)` for declarative initialization with reactive `{ ready, error }` state; the imperative `EdotReactNative.initialize(config)` is also available for non-React contexts
- **Network instrumentation** — automatic span creation for `fetch` and `XMLHttpRequest` (including Axios) with W3C trace context propagation
- **Error tracking** — captures uncaught JS exceptions, unhandled Promise rejections, and React render errors via `EdotErrorBoundary`
- **Startup tracing** — cold start performance with `AppStartup: js_bundle_load` and `AppStartup: first_render` child spans under an `AppStartup: cold` parent
- **App-state tracking** — foreground/background screen-lifetime spans with active-screen replay on resume
- **Lifecycle events** — emitted natively by the EDOT iOS/Android agents per the Elastic mobile agents spec
- **App + system metrics** — `application.launch.time` histogram plus `system.cpu.usage` and `system.memory.usage` observable gauges on both platforms (iOS via MetricKit + Mach task APIs; Android via Choreographer + `Process.getElapsedCpuTime` + `Debug.MemoryInfo`)
- **User interactions** — `withEdotTracking` HOC and `useEdotAction` hook for tap/action tracking
- **Manual instrumentation** — see [`@inoxth/react-native-edot-tracer-provider`](../react-native-tracer-provider) for custom spans and metrics
- **Navigation tracking** — see [`@inoxth/react-native-edot-navigation`](../react-native-navigation) for screen spans
- **Ignore filters** — `ignoreSpanNames`, `ignoreLogPatterns` for noise control on both platforms

## Install

```bash
yarn add @inoxth/react-native-edot-sdk
```

### iOS

```bash
cd ios && pod install
```

That's it. The SDK podspec declares the EDOT iOS agent (`apm-agent-ios`) as a Swift Package dependency via React Native's `spm_dependency` helper, so `pod install` resolves the package and links the `ElasticApm` product onto the SDK's pod target automatically. No manual Xcode SPM configuration is required.

On Expo, run `npx expo prebuild` (or `npx expo run:ios`) instead — it generates the `ios/` project and runs `pod install` for you.

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

No extra command needed — RN Gradle autolinking wires the SDK on the next `yarn android` / `./gradlew` build.

> ⚠️ **Do not apply `co.elastic.otel.android.instrumentation.okhttp`.** RN's `fetch` / `XHR` are already instrumented at the JS layer — adding the OkHttp Gradle plugin would emit a second span per HTTP call, doubling APM ingest cost. If you need OkHttp instrumentation for non-RN code paths in the same app, install an interceptor that skips requests carrying the `X-Edot-RN-Traced` header (set by the JS-layer instrumentation).

## Initialize

```typescript
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';

await EdotReactNative.initialize({
  serverUrl: 'https://your-apm-server:8200',
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
  secretToken: process.env.EDOT_SECRET_TOKEN,
});
```

Auto-instrumentation for network, errors, and startup is enabled by default. Lifecycle events (`event.name="lifecycle"`, `event.domain="device"`) are emitted natively by the EDOT iOS / Android agents per the Elastic mobile agents spec.

To report iOS and Android as distinct services in the Elastic APM service map, supply `serviceName` per platform — top-level `serviceName` then becomes optional:

```typescript
await EdotReactNative.initialize({
  serverUrl: 'https://your-apm-server:8200',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
  ios: { serviceName: 'myapp-ios' },
  android: { serviceName: 'myapp-android' },
});
```

The platform-specific `serviceName` overrides the top-level value when both are present. At least one must resolve for the active platform.

### React init hook

For React apps, `useEdot(config)` is the idiomatic entry point — it calls `initialize` once on mount and exposes reactive `{ ready, error }` state:

```tsx
import { useEdot, EdotErrorBoundary } from '@inoxth/react-native-edot-sdk';
import { ActivityIndicator, Text } from 'react-native';

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

  return (
    <EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
      <RootNavigator />
    </EdotErrorBoundary>
  );
}
```

Behavior:

- **First-wins.** Config is captured on the first render and reused on every subsequent render — re-renders never re-initialize. In `__DEV__`, a `console.warn` fires when a native-relevant primitive key (`serverUrl`, `serviceName`, `secretToken`, etc.) changes after first render.
- **Passive errors.** Init failures are stored in `error` and warned once to the console — never thrown. Observability degrades silently rather than crashing the app.
- **StrictMode-safe.** The underlying singleton guard in `EdotReactNative.initialize` short-circuits duplicate calls, so React 18+ double-mount in dev costs nothing.

For navigation-aware apps, mount the navigation root only once `ready` flips to `true` so the initial screen span is captured by the active tracer provider — see [`@inoxth/react-native-edot-navigation`](../react-native-navigation).

### Host-app pre-initialization (advanced)

If you need cold-start spans from native code that runs before the JS bundle loads, start the agent from the host app's entry point:

**iOS** — call from `application(_:didFinishLaunchingWithOptions:)`:

```swift
import EdotReactNative

EdotReactNativeAgent.preInitialize(
  serverUrl: "https://your-apm-server:8200",
  serviceName: "myapp-ios",
  serviceVersion: "1.0.0",
  deploymentEnvironment: "production",
  secretToken: "..."
)
```

**Android** — call from `MainApplication.onCreate()`:

```kotlin
import com.edot.reactnative.EdotReactNativeAgent

EdotReactNativeAgent.preInitialize(
  application = this,
  serverUrl = "https://your-apm-server:8200",
  serviceName = "myapp-android",
  serviceVersion = "1.0.0",
  deploymentEnvironment = "production",
  secretToken = "...",
)
```

Both signatures accept the same optional auth + transport surface as JS init: `secretToken`, `apiKey`, `sessionSamplingRate`, `exportProtocol`, plus `persistencePreset` (iOS) / `diskBufferingEnabled` (Android). When pre-initialized, the JS `initialize()` call skips agent start and (under `debug`) logs any reserved fields it receives that pre-init should have owned, since the agent is already running.

## Configuration

`EdotReactNative.initialize(config)` accepts the following options. The full type is exported as `EdotConfig`.

### Required

| Option                  | Type     | Description                                                                                                                                                            |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverUrl`             | `string` | EDOT / APM server URL                                                                                                                                                  |
| `serviceName`           | `string` | Service name (no `,` or `=`). Optional if `ios.serviceName` / `android.serviceName` is set for the active platform; the per-platform value wins when both are present. |
| `serviceVersion`        | `string` | Service version (no `,` or `=`)                                                                                                                                        |
| `deploymentEnvironment` | `string` | `production`, `staging`, etc.                                                                                                                                          |

### Authentication (pick one)

| Option        | Type     | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `secretToken` | `string` | Secret token. Mutually exclusive with `apiKey`. |
| `apiKey`      | `string` | API key. Mutually exclusive with `secretToken`. |

Both are wrapped in a redacted-string container immediately on receipt — `JSON.stringify(config)` will not leak them.

### Auto-instrumentation toggles

| Option                      | Type      | Default | Description                                 |
| --------------------------- | --------- | ------- | ------------------------------------------- |
| `instrumentNetworkRequests` | `boolean` | `true`  | `fetch` + XHR spans                         |
| `instrumentJsErrors`        | `boolean` | `true`  | Uncaught exceptions + unhandled rejections. Non-fatal errors are recorded as OTel `exception` events on the active view span (when one exists) or as `event.name=exception` log records. Fatal errors are emitted as `event.name=crash`, `event.domain=device` log records per the Elastic mobile crash event spec, so JS crashes surface alongside native crashes in Kibana. |
| `instrumentAppStartup`      | `boolean` | `true`  | Cold/warm start spans                       |
| `appStateTracking`          | `boolean` | `true`  | Foreground/background screen-lifetime spans |

### Network filtering

| Option                    | Type                      | Description                                                          |
| ------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `tracePropagationTargets` | `(string \| RegExp)[]`    | Allowlist of URLs to inject `traceparent` into. **Default (omitted): inject on all outbound requests** (matching the iOS native agent), except `serverUrl` / `ignoreUrls`. Pass `[]` to opt out entirely. |
| `ignoreUrls`              | `(string \| RegExp)[]`    | URLs to skip span creation for.                                      |
| `graphqlUrls`             | `(string \| RegExp)[]`    | URLs treated as GraphQL endpoints. Operation type + name are parsed from the body; spans are named `<type> <name>` (e.g. `query GetUser`) per OTel GraphQL semconv, and `graphql.operation.type` / `graphql.operation.name` attributes are set. |
| `urlSanitizer`            | `(url: string) => string` | Strip secrets/PII from `http.url` before export.                     |

### Sampling & consent

| Option                | Type                                      | Description                                      |
| --------------------- | ----------------------------------------- | ------------------------------------------------ |
| `sessionSamplingRate` | `number`                                  | `0.0`–`1.0`. Defaults to native agent's default. |
| `trackingConsent`     | `'granted' \| 'pending' \| 'not_granted'` | JS-side emission gate.                           |

### Transport

| Option           | Type               | Description                                                                                                                                                                                                              |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exportProtocol` | `'http' \| 'grpc'` | Defaults to `'http'` on both platforms. The SDK overrides upstream defaults (apm-agent-ios → gRPC, apm-agent-android → HTTP) so the same omitted-config produces the same transport everywhere. Set explicitly for gRPC. |

### Native metrics (cross-platform)

| Option                           | Type      | Default | Description                                                                                                                                                                                  |
| -------------------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableAppMetricInstrumentation` | `boolean` | `true`  | Emit `application.launch.time` histogram (iOS via MetricKit, Android via Choreographer). Set `false` to skip the install.                                                                    |
| `enableSystemMetrics`            | `boolean` | `true`  | Emit `system.cpu.usage` and `system.memory.usage` observable gauges (iOS via Mach task APIs, Android via `Process.getElapsedCpuTime` + `Debug.MemoryInfo`). Set `false` to skip the install. |

### Ignore filters

| Option                | Type                                                                                                                  | Description                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ignoreSpanNames`     | `(string \| { source: string; flags?: string })[]`                                                                    | Drop spans whose name matches any rule. Exact-string or regex-source matches.                                                                             |
| `ignoreLogPatterns`   | `Array<{ name?: string \| RegexSource; minSeverity?: 'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal' }>` | Drop log records matching any rule (name match OR severity below `minSeverity`).                                                                          |

Real `RegExp` objects don't survive the React Native bridge, so regex rules use the `{ source, flags? }` shape instead.

### Lifecycle / opt-out

| Option         | Type      | Description                                                                                                                                                                |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disableAgent` | `boolean` | Fully suppresses native agent startup. Distinct from `trackingConsent: 'not_granted'` (which gates JS-side emission only). Use for test environments / hard opt-out flows. |

### iOS-only

Pass these under `ios: { … }` in the config:

| Option                                    | Type                                      | Description                                                                                                             |
| ----------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ios.serviceName`                         | `string`                                  | Override `serviceName` on iOS. Falls back to top-level `serviceName` when omitted.                                      |
| `ios.enableCrashReporting`                | `boolean`                                 | Enable native crash reporting.                                                                                          |
| `ios.enableURLSessionInstrumentation`     | `boolean`                                 | Enable native `URLSession` HTTP spans. Off by default — JS-side fetch/XHR instrumentation is the canonical path.        |
| `ios.enableViewControllerInstrumentation` | `boolean`                                 | Enable `UIViewController` lifecycle spans. Off by default — JS navigation plugin is the canonical path.                 |
| `ios.enableLifecycleEvents`               | `boolean`                                 | Enable foreground/background/inactive/terminate lifecycle events.                                                       |
| `ios.persistencePreset`                   | `'default' \| 'lowUsage' \| 'highVolume'` | iOS on-disk persistence buffer tuning. Android uses `android.diskBufferingEnabled` instead.                             |

### Android-only

Pass these under `android: { … }` in the config:

| Option                         | Type      | Description                                                                            |
| ------------------------------ | --------- | -------------------------------------------------------------------------------------- |
| `android.serviceName`          | `string`  | Override `serviceName` on Android. Falls back to top-level `serviceName` when omitted. |
| `android.diskBufferingEnabled` | `boolean` | Persist signals across process restarts. iOS uses `ios.persistencePreset` instead.     |

### Debug

| Option  | Type      | Description                                     |
| ------- | --------- | ----------------------------------------------- |
| `debug` | `boolean` | Enables `[EDOT]` console logs from the JS side. |

## Error boundary

Wrap your app to capture render errors as spans:

```tsx
import { EdotErrorBoundary } from '@inoxth/react-native-edot-sdk';
import { Text } from 'react-native';

export function App() {
  return (
    <EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
      <RootNavigator />
    </EdotErrorBoundary>
  );
}
```

Render errors are routed through the same path as uncaught JS exceptions: when an active view exists, they're recorded as an OTel `exception` event on the view span; otherwise they emit a stand-alone log record with `event.name=exception` and `exception.type` / `exception.message` / `exception.stacktrace` attributes.

## User interactions

### `withEdotTracking` HOC

```tsx
import { withEdotTracking } from '@inoxth/react-native-edot-sdk';
import { TouchableOpacity } from 'react-native';

const TrackedButton = withEdotTracking(TouchableOpacity, 'CheckoutButton');

// Renders normally; emits a tap action when pressed.
<TrackedButton onPress={handleCheckout}>...</TrackedButton>;
```

### `useEdotAction` hook

```typescript
import { useEdotAction } from '@inoxth/react-native-edot-sdk';

function CheckoutScreen() {
  const { trackAction } = useEdotAction();

  function handlePurchase() {
    trackAction('tap', 'Purchase', { 'cart.items': 3 });
  }
}
```

## Tracking consent

```typescript
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';

EdotReactNative.setTrackingConsent('granted');
```

`setTrackingConsent` gates JS-side emission at runtime — `'granted'` | `'not_granted'` | `'pending'`. To suppress the native agent entirely, set `disableAgent: true` in the init config instead.

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
