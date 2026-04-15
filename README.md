# React Native EDOT SDK

OpenTelemetry-compliant observability SDK for React Native. Wraps the native [EDOT iOS](https://github.com/elastic/apm-agent-ios) and [EDOT Android](https://github.com/elastic/elastic-otel-android) agents to provide automatic and manual instrumentation with zero-config setup.

## Features

- **Network instrumentation** — automatic span creation for `fetch` and `XMLHttpRequest` (including Axios) with W3C trace context propagation
- **Error tracking** — captures uncaught JS exceptions, unhandled Promise rejections, and React render errors via `EdotErrorBoundary`
- **Navigation tracking** — view spans for React Navigation, Expo Router, and Wix react-native-navigation
- **Lifecycle tracking** — foreground/background/inactive state transitions
- **Startup tracing** — cold and warm start performance with JS bundle load and first render phases
- **User interactions** — `withEdotTracking` HOC and `useEdotAction` hook for tap/action tracking
- **Manual instrumentation** — custom spans, metrics (Counter, Histogram, UpDownCounter), and structured logs
- **Source map upload** — CLI tool for server-side crash stack symbolication
- **Dual architecture** — supports both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric)

## Packages

| Package | Description |
|---|---|
| [`@inox/react-native-edot-sdk`](./packages/react-native) | Core SDK — config, native bridge, auto-instrumentation, public API |
| [`@inox/react-native-edot-navigation`](./packages/react-native-navigation) | React Navigation integration |
| [`@inox/react-native-edot-expo-router`](./packages/react-native-expo-router) | Expo Router integration |
| [`@inox/react-native-edot-wix-navigation`](./packages/react-native-wix-navigation) | Wix react-native-navigation integration |
| [`@inox/react-native-edot-tracer-provider`](./packages/react-native-tracer-provider) | Manual tracing and metrics API |
| [`@inox/react-native-edot-cli`](./packages/cli) | Source map upload CLI |
| [`@inox/react-native-edot-shared`](./packages/shared) | Shared internal state (not for direct use) |

## Quick Start

### 1. Install

```bash
yarn add @inox/react-native-edot-sdk
```

For navigation tracking, add the plugin for your router:

```bash
# React Navigation
yarn add @inox/react-native-edot-navigation

# Expo Router
yarn add @inox/react-native-edot-expo-router

# Wix react-native-navigation
yarn add @inox/react-native-edot-wix-navigation
```

### 2. iOS Setup

```bash
cd ios && pod install
```

### 3. Initialize

```typescript
import { EdotReactNative } from '@inox/react-native-edot-sdk';

await EdotReactNative.initialize({
  serverUrl: 'https://your-apm-server:8200',
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',
});
```

All auto-instrumentation (network, errors, lifecycle, startup) is enabled by default.

## Configuration

```typescript
import { EdotReactNative } from '@inox/react-native-edot-sdk';

await EdotReactNative.initialize({
  // Required
  serverUrl: 'https://your-apm-server:8200',
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'production',

  // Authentication (pick one)
  secretToken: 'your-secret-token',
  // apiKey: 'your-api-key',

  // Auto-instrumentation toggles (all default to true)
  instrumentNetworkRequests: true,
  instrumentJsErrors: true,
  instrumentAppLifecycle: true,
  instrumentAppStartup: true,

  // Network
  tracePropagationTargets: [/api\.example\.com/],
  ignoreUrls: [/analytics\.example\.com/],
  graphqlUrls: [/\/graphql$/],

  // Sampling & consent (optional, no defaults)
  sessionSamplingRate: 0.5,        // 0.0 to 1.0
  trackingConsent: 'granted',      // 'granted' | 'pending' | 'not_granted'

  // Platform-specific
  ios: { connectionType: 'grpc', enableCrashReporting: true },
  android: { exportProtocol: 'grpc', diskBufferingEnabled: true },

  // Debug
  debug: false,
});
```

## Navigation Tracking

### React Navigation

```typescript
import { createEdotNavigationContainerRef } from '@inox/react-native-edot-navigation';

const { navigationRef, onStateChange, onReady, cleanup } =
  createEdotNavigationContainerRef({
    screenNameMapper: (name, params) => name, // optional
  });

function App() {
  useEffect(() => cleanup, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={onStateChange}
      onReady={onReady}
    >
      {/* screens */}
    </NavigationContainer>
  );
}
```

### Expo Router

```tsx
import { EdotExpoNavigationProvider } from '@inox/react-native-edot-expo-router';

export default function Layout() {
  return (
    <EdotExpoNavigationProvider
      screenNameMapper={(pathname) => pathname.replace(/\/\d+/g, '/:id')}
    >
      <Slot />
    </EdotExpoNavigationProvider>
  );
}
```

### Wix react-native-navigation

```typescript
import { Navigation } from 'react-native-navigation';
import { registerEdotNavigationListener } from '@inox/react-native-edot-wix-navigation';

const cleanup = registerEdotNavigationListener(Navigation, {
  screenNameMapper: (componentName) => componentName,
});
```

## Error Boundary

```tsx
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';

<EdotErrorBoundary fallback={<Text>Something went wrong</Text>}>
  <MyApp />
</EdotErrorBoundary>
```

## User Interactions

### HOC

```tsx
import { withEdotTracking } from '@inox/react-native-edot-sdk';
import { TouchableOpacity } from 'react-native';

const TrackedButton = withEdotTracking(TouchableOpacity, 'CheckoutButton');
```

### Hook

```typescript
import { useEdotAction } from '@inox/react-native-edot-sdk';

function CheckoutScreen() {
  const { trackAction } = useEdotAction();

  const handlePurchase = () => {
    trackAction('tap', 'Purchase', { 'cart.items': 3 });
  };
}
```

## Manual Instrumentation

```typescript
import {
  getTracerProvider,
  getMeterProvider,
  SpanStatusCode,
} from '@inox/react-native-edot-tracer-provider';

// Custom spans
const tracer = getTracerProvider().getTracer('checkout');
const span = tracer.startSpan('processPayment');
span.setAttribute('payment.method', 'credit_card');
span.setStatus(SpanStatusCode.OK);
span.end();

// Custom metrics
const meter = getMeterProvider().getMeter('business');
const counter = meter.createCounter('orders_placed');
counter.add(1, { region: 'us-east' });
```

## Session & User APIs

```typescript
import { EdotReactNative } from '@inox/react-native-edot-sdk';

// User identity
EdotReactNative.setUser({ id: 'user-123', email: 'user@example.com', name: 'Alice' });
EdotReactNative.clearUser();

// Session attributes
EdotReactNative.setSessionAttribute('subscription', 'premium');

// Global attributes (attached to all telemetry)
EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
EdotReactNative.removeGlobalAttribute('tenant_id');

// Tracking consent
EdotReactNative.setTrackingConsent('granted');

// Structured logs
EdotReactNative.log('info', 'Payment completed', { orderId: 'ord-456' });
```

## Source Map Upload

Upload source maps for server-side crash symbolication:

```bash
npx @inox/react-native-edot-cli upload-sourcemap \
  --server-url https://your-apm-server:8200 \
  --service-name my-app \
  --service-version 1.0.0 \
  --bundle-path ios/main.jsbundle \
  --sourcemap-path ios/main.jsbundle.map \
  --secret-token your-token
```

## Requirements

- React Native >= 0.72
- iOS >= 16.0
- Android minSdk 24
- Node.js >= 18

## Development

```bash
yarn install
yarn typecheck          # TypeScript check
yarn test               # Run all tests
yarn lint               # oxlint
yarn fmt                # oxfmt
yarn build              # Build all packages
```

## Examples

| Example | Directory | Description |
|---|---|---|
| Basic | [`example/basic/`](./example/basic) | SDK init, manual tracing, metrics, logs, network, errors, interactions — no navigation |
| React Navigation | [`example/react-navigation/`](./example/react-navigation) | Bottom tabs + stack navigation with `@inox/react-native-edot-navigation` |
| Expo Router | [`example/expo-router/`](./example/expo-router) | Tab + stack routes with `@inox/react-native-edot-expo-router` |
| Wix Navigation | [`example/wix-navigation/`](./example/wix-navigation) | Bottom tabs + push navigation with `@inox/react-native-edot-wix-navigation` |

Each example uses `.env` for configuration. Copy `.env.example` to `.env` and fill in your EDOT server details.

## License

MIT
