# EDOT React Native SDK — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-04-06
**Author:** Technical Lead — Mobile Platform Engineering
**Status:** Draft for Claude Code Implementation

---

## 1. Executive Summary

This document specifies the design and implementation requirements for **`@inox-edot/react-native`** — an open-source React Native SDK that wraps the native EDOT (Elastic Distribution of OpenTelemetry) iOS and Android SDKs into a unified JavaScript/TypeScript API. The SDK enables React Native applications to send OpenTelemetry-compliant traces, metrics, and logs to an Elastic APM Server (or any OTLP-compatible backend).

The primary use case is a client migration from the **DataDog React Native SDK (`@datadog/mobile-react-native`)** to EDOT. The SDK must achieve feature parity with DataDog RUM capabilities while leveraging Elastic's native EDOT agents under the hood.

### 1.1 Goals

- Provide a drop-in observability SDK for React Native that wraps EDOT iOS (v2.x) and EDOT Android (v1.x) native SDKs.
- Support auto-instrumentation of: network requests, navigation, JS errors, native crashes, and app lifecycle.
- Offer manual instrumentation APIs aligned with OpenTelemetry JS API conventions.
- Ensure smooth migration path from DataDog React Native SDK with a migration guide and comparable API surface.
- Support both Old Architecture (Bridge) and New Architecture (TurboModules/Fabric) for React Native 0.72+.
- Publish as open-source monorepo on npm.

### 1.2 Non-Goals

- WebView tracking (explicitly excluded from scope).
- Reimplementing native telemetry collection (delegate entirely to EDOT native SDKs).
- Supporting React Native versions below 0.72.
- Building a custom OTLP Collector — the SDK exports to an existing Elastic APM Server.

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     React Native Application                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    JavaScript Thread                          │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │   │
│  │  │ Auto-Instru │  │ Manual Instru│  │ Navigation Plugin │   │   │
│  │  │ mentation   │  │ mentation API│  │ (per library)     │   │   │
│  │  │             │  │              │  │                   │   │   │
│  │  │ • fetch     │  │ • Tracer     │  │ • @react-nav      │   │   │
│  │  │ • XHR       │  │ • Meter      │  │ • wix-nav         │   │   │
│  │  │ • errors    │  │ • Logger     │  │ • expo-router      │   │   │
│  │  │ • promises  │  │ • Custom Span│  │                   │   │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘   │   │
│  │         │                │                    │              │   │
│  │         └────────────────┼────────────────────┘              │   │
│  │                          │                                   │   │
│  │                ┌─────────▼──────────┐                        │   │
│  │                │  EdotReactNative    │                        │   │
│  │                │  (Core JS Module)   │                        │   │
│  │                │                    │                        │   │
│  │                │  • SpanProcessor   │                        │   │
│  │                │  • ContextManager  │                        │   │
│  │                │  • SessionManager  │                        │   │
│  │                │  • ErrorHandler    │                        │   │
│  │                └─────────┬──────────┘                        │   │
│  └──────────────────────────┼───────────────────────────────────┘   │
│                             │                                       │
│               ┌─────────────▼─────────────┐                         │
│               │  Native Bridge / JSI       │                         │
│               │  (TurboModule or Bridge)   │                         │
│               └──────┬──────────────┬──────┘                         │
│                      │              │                                │
│  ┌───────────────────▼──┐    ┌──────▼───────────────────┐           │
│  │   iOS Native Module   │    │  Android Native Module    │           │
│  │                       │    │                           │           │
│  │  ┌─────────────────┐  │    │  ┌──────────────────────┐ │           │
│  │  │  EDOT iOS SDK   │  │    │  │  EDOT Android SDK    │ │           │
│  │  │  (apm-agent-ios)│  │    │  │  (apm-agent-android) │ │           │
│  │  │                 │  │    │  │                      │ │           │
│  │  │  • URLSession   │  │    │  │  • OkHttp intercept  │ │           │
│  │  │  • Crash (PLCr) │  │    │  │  • Crash (uncaught)  │ │           │
│  │  │  • Lifecycle    │  │    │  │  • ANR detection     │ │           │
│  │  │  • MetricKit   │  │    │  │  • Activity lifecycle │ │           │
│  │  │  • Session mgmt│  │    │  │  • Slow rendering    │ │           │
│  │  └────────┬────────┘  │    │  │  • Session mgmt     │ │           │
│  │           │           │    │  └──────────┬───────────┘ │           │
│  └───────────┼───────────┘    └─────────────┼─────────────┘           │
│              │                              │                        │
│              └──────────┬───────────────────┘                        │
│                         │                                            │
│              ┌──────────▼──────────┐                                 │
│              │    OTLP Exporter    │                                  │
│              │  (gRPC or HTTP)     │                                  │
│              └──────────┬──────────┘                                 │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │  Elastic APM Server │
               │  (or OTLP backend)  │
               └──────────┬──────────┘
                          │
               ┌──────────▼──────────┐
               │    Elasticsearch    │
               │    + Kibana         │
               └─────────────────────┘
```

### 2.2 Design Principles

1. **Native-First Telemetry**: All low-level telemetry (crash, ANR, lifecycle, network at OS level) is captured by EDOT native SDKs. The RN layer does NOT reimplement these.
2. **JS-Layer Augmentation**: The JS layer adds React Native-specific instrumentation: fetch/XHR patching, JS error boundaries, navigation tracking, and a unified API surface.
3. **Bridge-Agnostic**: The SDK must work on both the legacy Bridge (NativeModules) and the New Architecture (TurboModules via JSI). Use a conditional codegen approach.
4. **Monorepo with Optional Packages**: Core SDK is minimal; navigation and other integrations are separate packages so apps only bundle what they use.
5. **OpenTelemetry-Aligned API**: All manual instrumentation APIs follow the OpenTelemetry JS API conventions so users familiar with OTel feel at home.

### 2.3 Monorepo Package Structure

```
@inox-edot/react-native                  # Core SDK (required)
@inox-edot/react-native-navigation       # @react-navigation/native plugin
@inox-edot/react-native-wix-navigation   # react-native-navigation (Wix) plugin
@inox-edot/react-native-expo-router      # expo-router plugin
@inox-edot/react-native-tracer-provider  # OTel TracerProvider wrapper
```

**Note on naming**: The `@inox-edot` scope is a placeholder. Final scope should be coordinated with the client and Elastic. Alternatives: `@edot-rn`, `@elastic-otel-rn`, or the client's own npm scope.

---

## 3. Detailed Feature Specifications

### 3.1 SDK Initialization & Configuration

#### 3.1.1 JavaScript API

```typescript
import { EdotReactNative, EdotConfig } from '@inox-edot/react-native';

const config: EdotConfig = {
  // Required
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'my-rn-app',
  serviceVersion: '1.2.0',
  deploymentEnvironment: 'production',

  // Authentication (pick one)
  secretToken: '<token>',
  // OR
  apiKey: '<api-key>',

  // Export settings
  exportProtocol: 'otlp/http',      // 'otlp/http' | 'otlp/grpc' — default: 'otlp/http'

  // Sampling
  sessionSamplingRate: 1.0,          // 0.0 to 1.0, default 1.0

  // Auto-instrumentation toggles
  instrumentNetworkRequests: true,    // default: true
  instrumentJsErrors: true,           // default: true
  instrumentNativeCrashes: true,      // default: true
  instrumentAppLifecycle: true,       // default: true

  // Network instrumentation config
  tracePropagationTargets: [          // Hosts to inject W3C traceparent header
    /api\.example\.com/,
    /graphql\.example\.com/,
  ],
  ignoreUrls: [                       // URLs to exclude from tracing
    /\/health$/,
    /analytics\.third-party\.com/,
  ],

  // iOS-specific
  ios: {
    enableMetricKit: true,            // default: true
    enableViewControllerTracing: false, // default: false (RN manages its own views)
  },

  // Android-specific
  android: {
    enableAnrDetection: true,         // default: true
    enableSlowRenderingDetection: true, // default: true
    diskBufferingEnabled: true,       // default: true
  },

  // Debug
  debug: false,                       // default: false — enables verbose internal logging
};

// Initialize — must be called as early as possible (e.g., in index.js before App registration)
await EdotReactNative.initialize(config);
```

#### 3.1.2 Native-Side Early Initialization (Optional)

For capturing crashes that occur before the JS bundle loads, the SDK should support optional native-side pre-initialization.

**iOS — AppDelegate.swift:**

```swift
import EdotReactNative

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    EdotReactNativeAgent.preInitialize(
        serverUrl: "https://apm.example.com:8200",
        secretToken: "<token>"
    )
    // ... rest of app delegate
}
```

**Android — MainApplication.kt:**

```kotlin
import com.edot.reactnative.EdotReactNativeAgent

class MainApplication : Application(), ReactApplication {
    override fun onCreate() {
        super.onCreate()
        EdotReactNativeAgent.preInitialize(
            this,
            serverUrl = "https://apm.example.com:8200",
            secretToken = "<token>"
        )
        // ... rest of application setup
    }
}
```

When `preInitialize` is called natively, the subsequent JS-side `EdotReactNative.initialize()` merges the JS-specific config (navigation, network patching, etc.) with the already-running native agent. The native agent should NOT be started twice.

#### 3.1.3 Configuration Object — Full TypeScript Interface

```typescript
interface EdotConfig {
  // ── Required ──────────────────────────────────────────────────────
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;

  // ── Authentication (mutually exclusive) ───────────────────────────
  secretToken?: string;
  apiKey?: string;

  // ── Export ────────────────────────────────────────────────────────
  exportProtocol?: 'otlp/http' | 'otlp/grpc';  // default: 'otlp/http'
  customExportHeaders?: Record<string, string>;

  // ── Sampling ──────────────────────────────────────────────────────
  sessionSamplingRate?: number;  // 0.0–1.0, default: 1.0

  // ── Auto-Instrumentation Toggles ──────────────────────────────────
  instrumentNetworkRequests?: boolean;   // default: true
  instrumentJsErrors?: boolean;          // default: true
  instrumentNativeCrashes?: boolean;     // default: true
  instrumentAppLifecycle?: boolean;      // default: true

  // ── Network Config ────────────────────────────────────────────────
  tracePropagationTargets?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];

  // ── Platform-Specific ─────────────────────────────────────────────
  ios?: {
    enableMetricKit?: boolean;
    enableViewControllerTracing?: boolean;
  };
  android?: {
    enableAnrDetection?: boolean;
    enableSlowRenderingDetection?: boolean;
    diskBufferingEnabled?: boolean;
  };

  // ── Privacy & Consent ──────────────────────────────────────────────
  trackingConsent?: 'granted' | 'not_granted' | 'pending';  // default: 'granted'
  urlSanitizer?: (url: string) => string;   // strip PII from URLs before recording
  requestHeadersToCapture?: string[];       // allowlist of headers to record
  responseHeadersToCapture?: string[];      // allowlist of headers to record

  // ── Global Attributes ─────────────────────────────────────────────
  globalAttributes?: Record<string, string | number | boolean>;

  // ── Startup Tracing ───────────────────────────────────────────────
  instrumentAppStartup?: boolean;  // default: true — trace cold/warm start to TTI

  // ── OTA / CodePush ────────────────────────────────────────────────
  codePushVersion?: string;  // override serviceVersion for CodePush bundles

  // ── GraphQL ────────────────────────────────────────────────────────
  graphqlUrls?: (string | RegExp)[];  // URLs to extract GraphQL operation names from

  // ── Debug ─────────────────────────────────────────────────────────
  debug?: boolean;
  debugExportToConsole?: boolean;  // log OTLP payloads to console
}
```

---

### 3.2 Network Request Auto-Instrumentation

#### 3.2.1 What to Intercept

The SDK must monkey-patch both `global.fetch` and `XMLHttpRequest` on the JS thread to create OTel spans for every outgoing HTTP request.

#### 3.2.2 Span Attributes (per OpenTelemetry HTTP Semantic Conventions)

| Attribute | Source | Example |
|---|---|---|
| `http.method` | Request method | `GET` |
| `http.url` | Full URL | `https://api.example.com/users` |
| `http.status_code` | Response status | `200` |
| `http.request_content_length` | Request body size | `1024` |
| `http.response_content_length` | Response body size | `4096` |
| `http.scheme` | URL scheme | `https` |
| `net.host.name` | Host from URL | `api.example.com` |
| `net.host.port` | Port from URL | `443` |
| `http.flavor` | HTTP version | `1.1` |

#### 3.2.3 Trace Context Propagation

For URLs matching `tracePropagationTargets`, the SDK must inject the W3C `traceparent` header into outgoing requests:

```
traceparent: 00-{trace-id}-{span-id}-{trace-flags}
```

This enables distributed tracing from the mobile app through backend services.

#### 3.2.4 Implementation Approach

```typescript
// Pseudo-code for fetch instrumentation
const originalFetch = global.fetch;

global.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.url;

  if (shouldIgnore(url)) {
    return originalFetch(input, init);
  }

  const span = tracer.startSpan(`HTTP ${method}`, {
    kind: SpanKind.CLIENT,
    attributes: { 'http.method': method, 'http.url': url },
  });

  if (shouldPropagate(url)) {
    injectTraceContext(span, init.headers);
  }

  try {
    const response = await originalFetch(input, init);
    span.setAttribute('http.status_code', response.status);
    span.setStatus(response.ok ? SpanStatusCode.OK : SpanStatusCode.ERROR);
    span.end();
    return response;
  } catch (error) {
    span.recordException(error);
    span.setStatus(SpanStatusCode.ERROR);
    span.end();
    throw error;
  }
};
```

The same pattern applies to `XMLHttpRequest` via `open`, `send`, and event listener hooks.

#### 3.2.5 Third-Party HTTP Libraries (Axios, etc.)

**Axios**: In React Native, Axios uses `XMLHttpRequest` as its default transport adapter. Because the SDK patches `XMLHttpRequest` globally, all Axios requests are automatically intercepted — no additional configuration or plugin is required.

**Other libraries built on XHR**: Any library that relies on `XMLHttpRequest` internally (e.g., `superagent`, `ky` when configured for RN) is also automatically covered.

**Edge case — Custom native HTTP adapters**: If a library or custom code bypasses both `fetch` and `XMLHttpRequest` and calls native HTTP APIs directly (e.g., via a custom NativeModule that invokes OkHttp on Android or URLSession on iOS), those requests will NOT be caught by the JS-level patches. However, they WILL be caught by the EDOT native SDK's own interceptors (OkHttp interceptor on Android, URLSession instrumentation on iOS), so network visibility is still maintained. The span origin will be "native" rather than "JS" in this case.

#### 3.2.6 Relationship with Native Network Instrumentation

EDOT iOS intercepts `URLSession` and EDOT Android intercepts `OkHttp`. These capture native-level network calls that do NOT go through JS (e.g., image loading by `<Image source={{uri}}>`). The JS-side fetch/XHR patches capture JS-initiated requests. Both produce spans that share the same session context, giving full network visibility.

To avoid duplicate spans for the same request, the SDK should set a custom request header (e.g., `X-Edot-RN-Traced: 1`) on JS-patched requests. The native module should check for this header and skip creating a duplicate span if present.

---

### 3.3 Navigation Tracking

Navigation tracking is split into separate packages per navigation library, each producing OTel spans for screen transitions.

#### 3.3.1 Span Schema for Navigation

| Attribute | Value |
|---|---|
| `span.name` | `Navigation: {ScreenName}` |
| `view.name` | Route/screen name |
| `view.url` | Route path (if available) |
| `view.previous` | Previous screen name |
| `view.transition_type` | `push`, `pop`, `replace`, `tab`, `modal` |

#### 3.3.2 `@inox-edot/react-native-navigation` (React Navigation)

```typescript
import { createEdotNavigationContainerRef } from '@inox-edot/react-native-navigation';
import { NavigationContainer } from '@react-navigation/native';

const navigationRef = createEdotNavigationContainerRef();

function App() {
  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={navigationRef.onStateChange}
    >
      {/* screens */}
    </NavigationContainer>
  );
}
```

**Implementation**: Listen to `onStateChange` on the NavigationContainer. On each state change, resolve the current route name via `navigationRef.getCurrentRoute()`. Start a new "view" span, end the previous one. Track the span from the navigation event until the next navigation event.

#### 3.3.3 `@inox-edot/react-native-wix-navigation` (Wix react-native-navigation)

```typescript
import { registerEdotNavigationListener } from '@inox-edot/react-native-wix-navigation';
import { Navigation } from 'react-native-navigation';

registerEdotNavigationListener(Navigation);
```

**Implementation**: Register a `ComponentDidAppearListener` on Wix Navigation's event emitter. Each `componentDidAppear` event creates a new view span with the component name.

#### 3.3.4 `@inox-edot/react-native-expo-router` (Expo Router)

```typescript
import { EdotExpoNavigationProvider } from '@inox-edot/react-native-expo-router';

export default function RootLayout() {
  return (
    <EdotExpoNavigationProvider>
      <Slot />
    </EdotExpoNavigationProvider>
  );
}
```

**Implementation**: Use `usePathname()` and `useSegments()` hooks from expo-router to detect route changes. Wrap in a context provider that listens to pathname changes and creates view spans.

---

### 3.4 Error & Crash Tracking

#### 3.4.1 JavaScript Errors

The SDK must capture:

1. **Uncaught JS exceptions** — via `ErrorUtils.setGlobalHandler()` (React Native's global error handler).
2. **Unhandled Promise rejections** — via `global.HermesInternal?.enablePromiseRejectionTracker()` or `require('promise/setimmediate/rejection-tracking')`.
3. **React component render errors** — provide an `EdotErrorBoundary` component that wraps React's `componentDidCatch`.

**Span/Log attributes for JS errors:**

| Attribute | Value |
|---|---|
| `exception.type` | Error constructor name (e.g., `TypeError`) |
| `exception.message` | Error message |
| `exception.stacktrace` | Full JS stack trace |
| `error.source` | `js_uncaught`, `js_promise_rejection`, `js_render_error` |
| `session.id` | Current session ID |

**Implementation — EdotErrorBoundary:**

```typescript
import { EdotErrorBoundary } from '@inox-edot/react-native';

function App() {
  return (
    <EdotErrorBoundary fallback={<ErrorFallbackScreen />}>
      <MainApp />
    </EdotErrorBoundary>
  );
}
```

The `EdotErrorBoundary` catches render errors, records them as OTel log events with `severity: ERROR`, and optionally re-throws or renders a fallback.

#### 3.4.2 Native Crashes

Native crashes are captured entirely by the EDOT native SDKs:

- **iOS**: PLCrashReporter integration within EDOT iOS — captures Objective-C/Swift exceptions, signals (SIGSEGV, SIGABRT), and Mach exceptions. Crash reports are uploaded on next app launch.
- **Android**: `Thread.UncaughtExceptionHandler` within EDOT Android — captures JVM exceptions and native (NDK) crashes. Crash reports are buffered to disk and uploaded on next launch.

The RN SDK's native module must ensure the EDOT native agent is initialized before any user code runs (see Section 3.1.2 on early init).

#### 3.4.3 ANR Detection (Android Only)

EDOT Android SDK detects ANR (Application Not Responding) when the main thread is blocked for >5 seconds. This is handled entirely by the native SDK. The RN layer does not need to implement ANR detection but should ensure the native SDK's ANR instrumentation is enabled via config.

#### 3.4.4 JS Error to Native Bridge — Error Context Enrichment

When a JS error is caught, the SDK should call across the bridge to attach the JS error context to the current native session:

```typescript
// Internal SDK code
function reportJsError(error: Error, source: string) {
  const span = tracer.startSpan('JS Error', {
    attributes: {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
      'error.source': source,
    },
  });
  span.setStatus(SpanStatusCode.ERROR);
  span.end();

  // Also send to native for session-level crash correlation
  NativeEdotModule.reportJsException({
    name: error.name,
    message: error.message,
    stack: error.stack,
    isFatal: source === 'js_uncaught',
  });
}
```

---

### 3.5 App Lifecycle Tracking

#### 3.5.1 JS-Level Lifecycle Events

Using React Native's `AppState` API, the SDK tracks:

| Event | Span Name | Trigger |
|---|---|---|
| App foreground | `AppLifecycle: foreground` | `AppState` → `active` |
| App background | `AppLifecycle: background` | `AppState` → `background` |
| App inactive | `AppLifecycle: inactive` | `AppState` → `inactive` |

These spans include:

- `app.state`: `active`, `background`, `inactive`
- `session.id`: Current session ID
- Timestamp of state transition

#### 3.5.2 Native Lifecycle Events

The EDOT native SDKs handle platform-specific lifecycle events:

- **iOS**: UIApplication lifecycle notifications, ViewController appearance/disappearance, MetricKit launch duration histograms.
- **Android**: Activity lifecycle callbacks (onCreate through onDestroy), Fragment lifecycle, process importance changes.

These are captured automatically by the native SDKs when `instrumentAppLifecycle` is enabled.

---

### 3.6 Session Management

#### 3.6.1 Session Lifecycle

Sessions are managed by the EDOT native SDKs. The RN layer accesses session state via the native bridge.

- A new session starts when the app launches (cold start) or returns to foreground after a configurable idle timeout.
- Session sampling is evaluated once at session start. If the session is sampled out, no telemetry is collected for the entire session.
- The `session.id` attribute is attached to all spans, metrics, and logs automatically.

#### 3.6.2 JS API for Session

```typescript
// Get current session ID (useful for support tickets, logs correlation)
const sessionId: string = await EdotReactNative.getCurrentSessionId();

// Set user identity for session correlation
EdotReactNative.setUser({
  id: 'user-123',
  email: 'user@example.com',    // optional
  name: 'John Doe',              // optional
});

// Clear user identity (e.g., on logout)
EdotReactNative.clearUser();

// Add session-level attributes (persisted for entire session)
EdotReactNative.setSessionAttribute('ab_test_variant', 'control');
EdotReactNative.setSessionAttribute('subscription_tier', 'premium');
```

---

### 3.7 Manual Instrumentation API

The SDK exposes an OpenTelemetry-aligned API for custom instrumentation.

#### 3.7.1 Tracer Provider

```typescript
import { getTracerProvider } from '@inox-edot/react-native-tracer-provider';

const tracerProvider = getTracerProvider();
const tracer = tracerProvider.getTracer('checkout-flow', '1.0.0');
```

#### 3.7.2 Custom Spans

```typescript
// Simple span
const span = tracer.startSpan('processPayment');
span.setAttribute('payment.method', 'credit_card');
span.setAttribute('payment.amount', 99.99);
try {
  await processPayment();
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
} finally {
  span.end();
}

// Nested spans (parent-child)
const parentSpan = tracer.startSpan('checkoutFlow');
const childSpan = tracer.startSpan('validateCart', {
  parent: parentSpan,
});
// ... work ...
childSpan.end();
parentSpan.end();
```

#### 3.7.3 Custom Metrics

```typescript
import { getMeterProvider } from '@inox-edot/react-native-tracer-provider';

const meter = getMeterProvider().getMeter('app-metrics', '1.0.0');

// Counter
const itemsAddedCounter = meter.createCounter('cart.items_added', {
  description: 'Number of items added to cart',
});
itemsAddedCounter.add(1, { 'item.category': 'electronics' });

// Histogram
const checkoutDuration = meter.createHistogram('checkout.duration_ms', {
  description: 'Checkout flow duration in milliseconds',
  unit: 'ms',
});
checkoutDuration.record(1523, { 'payment.method': 'apple_pay' });

// UpDownCounter
const cartSize = meter.createUpDownCounter('cart.size', {
  description: 'Current number of items in cart',
});
cartSize.add(1);   // item added
cartSize.add(-1);  // item removed
```

#### 3.7.4 Custom Logs

```typescript
import { EdotReactNative } from '@inox-edot/react-native';

// Structured logging
EdotReactNative.log('info', 'User completed onboarding', {
  'user.step': 'profile_setup',
  'onboarding.duration_ms': 4500,
});

EdotReactNative.log('warn', 'Slow API response detected', {
  'http.url': 'https://api.example.com/products',
  'http.duration_ms': 3200,
});

EdotReactNative.log('error', 'Payment processing failed', {
  'payment.provider': 'stripe',
  'error.code': 'card_declined',
});
```

**Log severity levels**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

---

### 3.8 Global Attributes & Resource Detection

#### 3.8.1 Automatic Resource Attributes

The SDK must automatically collect and attach these resource attributes (via native EDOT SDKs + RN layer):

| Attribute | Source | Example |
|---|---|---|
| `service.name` | Config | `my-rn-app` |
| `service.version` | Config | `1.2.0` |
| `deployment.environment` | Config | `production` |
| `telemetry.sdk.name` | Hardcoded | `edot-react-native` |
| `telemetry.sdk.version` | Package version | `0.1.0` |
| `telemetry.sdk.language` | Hardcoded | `javascript` |
| `os.type` | Native detection | `ios` / `android` |
| `os.version` | Native detection | `17.4` / `14` |
| `device.model.identifier` | Native detection | `iPhone15,2` / `Pixel 8` |
| `device.manufacturer` | Native detection | `Apple` / `Google` |
| `app.build` | Native detection | `42` |
| `rn.version` | RN runtime | `0.73.4` |
| `rn.hermes` | Runtime detection | `true` / `false` |
| `rn.architecture` | Runtime detection | `bridge` / `fabric` |

#### 3.8.2 Custom Global Attributes

```typescript
// Set at init time via config.globalAttributes
// OR dynamically at runtime:
EdotReactNative.setGlobalAttribute('company.tenant_id', 'acme-corp');
EdotReactNative.removeGlobalAttribute('company.tenant_id');
```

Global attributes are attached to ALL spans, metrics, and logs.

---

### 3.9 Symbolication & Deobfuscation (Source Maps, dSYM, ProGuard)

For crash stack traces and JS errors to be human-readable in production builds, the SDK tooling must handle three types of symbol mapping upload.

#### 3.9.1 JavaScript Source Maps (Hermes / Metro)

Production React Native apps bundle and minify JS code (especially with Hermes bytecode compilation). Without source maps, JS error stack traces show offsets like `bundle.hbc:1:234567` instead of `CheckoutScreen.tsx:42:8`.

**Requirements:**

- Provide a CLI tool or build-phase script: `edot-rn-sourcemap-upload` that uploads source maps to the Elastic APM Server's source map endpoint.
- Must support both Hermes bytecode (`.hbc` + `.hbc.map`) and plain Metro bundle (`.jsbundle` + `.map`).
- The upload must include `serviceName`, `serviceVersion`, and `bundleFilePath` so the APM server can match incoming stack frames to the correct source map.

**Integration point — build script:**

```bash
# Typically added as a post-build step in CI or package.json scripts
npx edot-rn-sourcemap-upload \
  --server-url https://apm.example.com:8200 \
  --secret-token <token> \
  --service-name my-rn-app \
  --service-version 1.2.0 \
  --bundle ./android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle \
  --sourcemap ./android/app/build/generated/sourcemaps/react/release/index.android.bundle.map \
  --platform android

# Same for iOS
npx edot-rn-sourcemap-upload \
  --server-url https://apm.example.com:8200 \
  --secret-token <token> \
  --service-name my-rn-app \
  --service-version 1.2.0 \
  --bundle ./ios/build/main.jsbundle \
  --sourcemap ./ios/build/main.jsbundle.map \
  --platform ios
```

**Elastic APM Source Map API**: Elastic APM Server accepts source maps via `POST /assets/v1/sourcemaps` (or the RUM source map endpoint). The CLI tool should use this API.

#### 3.9.2 Android ProGuard / R8 Mapping Files

When ProGuard or R8 is enabled (default for release builds), Java/Kotlin class and method names are obfuscated. Native crash stack traces become unreadable without the mapping file.

**Requirements:**

- Provide a Gradle task or CLI command that uploads `mapping.txt` after a release build.
- The mapping file is typically located at `app/build/outputs/mapping/{variant}/mapping.txt`.
- Elastic APM Server needs the mapping file associated with the correct `serviceVersion` and build number.

**Integration — Gradle task (added to app/build.gradle.kts):**

```kotlin
// Option 1: Gradle plugin task (preferred)
// The EDOT Android Gradle plugin should automatically register an upload task
tasks.register("uploadProguardMapping") {
    dependsOn("assembleRelease")
    doLast {
        exec {
            commandLine(
                "npx", "edot-rn-sourcemap-upload",
                "--type", "proguard",
                "--server-url", "https://apm.example.com:8200",
                "--secret-token", System.getenv("EDOT_SECRET_TOKEN"),
                "--service-name", "my-rn-app",
                "--service-version", android.defaultConfig.versionName,
                "--mapping-file", "app/build/outputs/mapping/release/mapping.txt"
            )
        }
    }
}
```

**Note**: The EDOT Android SDK may also handle ProGuard mapping upload natively via its Gradle plugin. If so, the RN SDK should document how to enable that rather than providing a separate mechanism. Verify with the EDOT Android SDK's `co.elastic.otel.android.agent` Gradle plugin capabilities.

#### 3.9.3 iOS dSYM Files

Xcode strips debug symbols from release binaries and produces dSYM (debug symbol) files. Without these, native iOS crash stack traces show only memory addresses.

**Requirements:**

- Provide a CLI command or Xcode build phase script that uploads dSYM files to Elastic APM.
- dSYM files are located in the Xcode archive: `*.xcarchive/dSYMs/*.dSYM`.
- For Bitcode-enabled builds, dSYMs are downloaded from App Store Connect after processing.

**Integration — Xcode Build Phase:**

```bash
# Add as a "Run Script" build phase in Xcode (after "Copy Bundle Resources")
if [ "$CONFIGURATION" = "Release" ]; then
  npx edot-rn-sourcemap-upload \
    --type dsym \
    --server-url https://apm.example.com:8200 \
    --secret-token "${EDOT_SECRET_TOKEN}" \
    --service-name my-rn-app \
    --service-version "${MARKETING_VERSION}" \
    --dsym-path "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"
fi
```

**Note**: The EDOT iOS SDK (apm-agent-ios) may have built-in dSYM upload support via SPM plugin or post-archive script. If so, document that approach as the primary method and the CLI as a fallback for CI pipelines.

#### 3.9.4 Expo Considerations

For Expo apps using EAS Build:

- **JS Source Maps**: EAS Build generates source maps automatically. The `edot-rn-sourcemap-upload` command should be added as a post-build hook in `eas.json`.
- **Android ProGuard**: EAS Build handles ProGuard; mapping files are available in the build artifacts.
- **iOS dSYM**: EAS Build produces dSYMs in the build output. Use `eas build:list` to download them or configure a webhook-based upload.

#### 3.9.5 Unified CLI Tool Summary

The `edot-rn-sourcemap-upload` CLI (shipped as part of the `@inox-edot/react-native` package or as a standalone `@inox-edot/cli` package) must support:

| Flag | Description |
|---|---|
| `--type` | `sourcemap`, `proguard`, or `dsym` |
| `--server-url` | Elastic APM Server URL |
| `--secret-token` / `--api-key` | Authentication |
| `--service-name` | Must match `config.serviceName` |
| `--service-version` | Must match `config.serviceVersion` |
| `--bundle` | Path to JS bundle (for sourcemap type) |
| `--sourcemap` | Path to `.map` file (for sourcemap type) |
| `--mapping-file` | Path to `mapping.txt` (for proguard type) |
| `--dsym-path` | Path to `.dSYM` directory (for dsym type) |
| `--platform` | `ios` or `android` (for sourcemap type) |
| `--dry-run` | Validate inputs without uploading |

### 3.10 Privacy, Consent & Data Scrubbing (GDPR)

DataDog has a first-class `trackingConsent` mechanism. The PRD must match this for a smooth migration.

#### 3.10.1 Tracking Consent API

```typescript
import { EdotReactNative, TrackingConsent } from '@inox-edot/react-native';

// At init time (default: 'granted')
await EdotReactNative.initialize({
  ...config,
  trackingConsent: 'pending',  // buffer locally, don't export yet
});

// Later, when user grants consent (e.g., cookie banner)
EdotReactNative.setTrackingConsent('granted');   // flush buffered data, begin exporting

// If user declines
EdotReactNative.setTrackingConsent('not_granted'); // drop buffered data, stop collection
```

**Behavior per consent state:**

| State | Collection | Local Buffer | Export |
|---|---|---|---|
| `granted` | Active | Yes | Yes (flush immediately) |
| `pending` | Active | Yes (hold in memory/disk) | No (wait for grant) |
| `not_granted` | Stopped | Purged | No |

**Implementation note**: On native side, when consent is `pending`, spans and logs are buffered in-memory (or disk on Android). When consent transitions to `granted`, the buffer is flushed to the OTLP exporter. When it transitions to `not_granted`, the buffer is purged and all instrumentation hooks are disabled.

#### 3.10.2 URL Sanitization / PII Scrubbing

Network URLs frequently contain PII: query parameters with tokens, user IDs in path segments, email addresses, etc.

**Default sanitizer**: The SDK should strip query parameters from URLs before recording them as span attributes. Only the path is recorded by default.

**Custom sanitizer**: Users can provide a `urlSanitizer` function:

```typescript
await EdotReactNative.initialize({
  ...config,
  urlSanitizer: (url) => {
    // Redact user IDs from path segments
    return url.replace(/\/users\/[^/]+/, '/users/{userId}');
  },
});
```

**Navigation screen name sanitization**: Route params may contain PII (e.g., `/profile/john-doe`). Navigation plugins should accept a `screenNameMapper` callback:

```typescript
createEdotNavigationContainerRef({
  screenNameMapper: (routeName, params) => {
    // Strip PII from screen name
    if (routeName === 'UserProfile') return 'UserProfile/{id}';
    return routeName;
  },
});
```

#### 3.10.3 Header Capture Allowlist

Request/response headers are NOT captured by default (they may contain auth tokens, cookies, etc.). Users explicitly opt-in via allowlists:

```typescript
await EdotReactNative.initialize({
  ...config,
  requestHeadersToCapture: ['content-type', 'accept', 'x-request-id'],
  responseHeadersToCapture: ['content-type', 'x-correlation-id'],
});
```

---

### 3.11 Offline Telemetry & Disk Buffering

#### 3.11.1 Android

EDOT Android SDK has disk buffering enabled by default. Telemetry is written to local storage and flushed when network is available. Controlled via `config.android.diskBufferingEnabled`.

#### 3.11.2 iOS

EDOT iOS SDK does NOT have built-in disk buffering. iOS suspends background network activity, meaning telemetry may be lost if:

- The app is backgrounded before the export batch is flushed.
- The device is offline.

**Mitigation strategy the SDK must implement:**

1. **Aggressive flushing on lifecycle transitions**: When `AppState` changes to `background` or `inactive`, immediately trigger a flush of all pending spans/logs/metrics to the native OTLP exporter.
2. **iOS Background Task**: Request a `UIApplication.beginBackgroundTask` to get ~30 seconds of background execution for flushing pending telemetry.
3. **Local disk cache (best-effort)**: Implement a lightweight SQLite or file-based buffer in the iOS native module that persists unsent telemetry. On next app launch, read and re-export.

```swift
// iOS native module — flush on background
NotificationCenter.default.addObserver(
    forName: UIApplication.willResignActiveNotification,
    object: nil, queue: .main
) { _ in
    let taskId = UIApplication.shared.beginBackgroundTask()
    self.flushAllPendingTelemetry {
        UIApplication.shared.endBackgroundTask(taskId)
    }
}
```

---

### 3.12 App Startup Performance Tracing

Track cold start, warm start, and time to interactive (TTI).

#### 3.12.1 Native Cold Start Span

The native module records a span from `application:didFinishLaunchingWithOptions:` (iOS) or `Application.onCreate()` (Android) until the first React Native screen renders.

**Span attributes:**

| Attribute | Value |
|---|---|
| `span.name` | `AppStartup: cold` or `AppStartup: warm` |
| `app.startup.type` | `cold`, `warm`, `hot` |
| `app.startup.duration_ms` | Time from native init to JS ready |
| `app.startup.js_bundle_load_ms` | Time to load and parse JS bundle |
| `app.startup.first_render_ms` | Time from JS ready to first screen render |

#### 3.12.2 Implementation

1. **Native side**: Record `nativeStartTimestamp` at the earliest point in `AppDelegate` / `MainApplication.onCreate()`.
2. **JS side**: Record `jsBundleLoadedTimestamp` when the SDK's `initialize()` is called.
3. **First render**: Use React's `useEffect` in the root component (or `InteractionManager.runAfterInteractions`) to capture first meaningful render time.
4. **Span creation**: Create a single `AppStartup` span with child spans for each phase.

---

### 3.13 GraphQL Request Handling

GraphQL APIs use a single endpoint (e.g., `POST /graphql`). Without special handling, all GraphQL spans have the same name (`HTTP POST /graphql`), making them indistinguishable.

#### 3.13.1 Operation Name Extraction

The SDK should inspect the request body of POST requests to URLs matching a configurable pattern and extract the GraphQL `operationName`:

```typescript
await EdotReactNative.initialize({
  ...config,
  graphqlUrls: [/\/graphql$/],  // URLs to apply GraphQL operation name extraction
});
```

**Span naming**: When a GraphQL operation name is found, the span name becomes `GraphQL: {operationName}` (e.g., `GraphQL: GetUserProfile`) instead of `HTTP POST`.

**Implementation**: In the fetch/XHR interceptor, if the URL matches `graphqlUrls`, attempt to parse the request body as JSON and read `.operationName` or extract the operation name from the `.query` string. This must be done carefully to avoid performance overhead on non-GraphQL requests.

#### 3.13.2 Span Attributes for GraphQL

| Attribute | Value |
|---|---|
| `graphql.operation.name` | `GetUserProfile` |
| `graphql.operation.type` | `query`, `mutation`, `subscription` |
| `graphql.document` | Truncated query string (first 500 chars, opt-in only) |

---

### 3.14 User Interaction Tracking

DataDog captures user actions (taps, scrolls). The EDOT SDK should provide equivalent functionality.

#### 3.14.1 Touch / Tap Tracking

Provide an optional HOC or hook that tracks user taps on interactive elements:

```typescript
import { withEdotTracking } from '@inox-edot/react-native';

// HOC approach
const TrackedButton = withEdotTracking(TouchableOpacity, {
  actionName: 'checkout_button_tap',
});

// OR — hook approach
function CheckoutButton() {
  const trackAction = useEdotAction();

  return (
    <TouchableOpacity onPress={() => {
      trackAction('checkout_button_tap', { 'cart.total': 99.99 });
      handleCheckout();
    }}>
      <Text>Checkout</Text>
    </TouchableOpacity>
  );
}
```

#### 3.14.2 Manual Action API

```typescript
// Record a custom user action
EdotReactNative.addAction('tap', 'Add to Cart', {
  'item.id': 'SKU-123',
  'item.price': 29.99,
});
```

**Span attributes:**

| Attribute | Value |
|---|---|
| `span.name` | `UserAction: {actionName}` |
| `user_action.type` | `tap`, `scroll`, `swipe`, `custom` |
| `user_action.target` | Element identifier or label |

---

### 3.15 OTA Updates (CodePush / Expo Updates)

When the JS bundle is updated via CodePush or Expo Updates without a full app store release, the `serviceVersion` from native config becomes stale. Source maps also change.

#### 3.15.1 Version Override

```typescript
import codePush from 'react-native-code-push';

const update = await codePush.getUpdateMetadata();

await EdotReactNative.initialize({
  ...config,
  serviceVersion: '1.2.0',
  codePushVersion: update?.label ?? undefined,  // e.g., "v23"
});
```

When `codePushVersion` is set, it is recorded as a resource attribute `app.codepush.version` and appended to `service.version` for source map matching (e.g., `1.2.0+v23`).

#### 3.15.2 Source Map Upload for OTA

Each CodePush/Expo Updates release must upload its own source map with the composite version string:

```bash
npx edot-rn-sourcemap-upload \
  --service-version "1.2.0+v23" \
  --bundle ./build/codepush/main.jsbundle \
  --sourcemap ./build/codepush/main.jsbundle.map \
  ...
```

---

### 3.16 Graceful Degradation & Error Resilience

#### 3.16.1 Native Module Not Found

If the native module fails to link (common during development or incorrect native setup), the SDK must NOT crash the app. It should log a warning and provide a no-op fallback:

```typescript
// src/nativeModule.ts
let EdotNativeModule: NativeModule;

try {
  const isTurboModuleEnabled = global.__turboModuleProxy != null;
  EdotNativeModule = isTurboModuleEnabled
    ? require('./NativeEdotReactNative').default
    : require('react-native').NativeModules.EdotReactNative;

  if (!EdotNativeModule) {
    throw new Error('EdotReactNative native module not found');
  }
} catch (e) {
  console.warn(
    '[EDOT] Native module not found. Telemetry will be disabled. ' +
    'Run `pod install` (iOS) or sync Gradle (Android).'
  );
  EdotNativeModule = createNoOpModule();  // All methods are no-ops
}
```

#### 3.16.2 Orphaned Span Cleanup

Spans that are started but never ended (due to errors, navigation interruptions, etc.) cause memory leaks and data quality issues.

**Mitigation:**

- Maintain a `Map<spanId, { startTime: number }>` in JS.
- Run a periodic cleanup (every 60 seconds) that ends any span older than a configurable timeout (default: 5 minutes) with status `DEADLINE_EXCEEDED`.
- On navigation away from a screen, auto-end any view spans from the previous screen.

#### 3.16.3 SDK Internal Error Isolation

All SDK code (instrumentation hooks, bridge calls) must be wrapped in try-catch. SDK errors must NEVER crash the host app. Internal errors should be logged at `debug` level when `config.debug` is true, and silently swallowed otherwise.

---

### 3.17 Thread Safety & Span Context Management

#### 3.17.1 JS Thread Span Map

The SDK maintains an in-memory map of active spans (`Map<string, Span>`) on the JS thread. Since JS is single-threaded, this map is inherently thread-safe. However, bridge callbacks from native are asynchronous, so:

- Span IDs returned from native `startSpan` must be stored before any async operation.
- The `startSpan` method on Android uses `isBlockingSynchronousMethod = true` to return the span ID synchronously via JSI (New Architecture) or synchronous bridge call. On iOS, the same pattern applies.

#### 3.17.2 Native Span Registry

On the native side, spans are stored in a concurrent-safe registry:

- **iOS**: Use `NSLock` or `os_unfair_lock` around the span dictionary.
- **Android**: Use `ConcurrentHashMap<String, Span>`.

This is necessary because native spans can be started/ended from multiple threads (main thread, network callback thread, etc.).

#### 3.17.3 Context Propagation Across Async Boundaries

JavaScript `async/await` does not have Zone.js-like context propagation. The SDK should provide a helper for manually propagating parent span context through async call chains:

```typescript
import { withSpanContext } from '@inox-edot/react-native-tracer-provider';

const parentSpan = tracer.startSpan('checkoutFlow');

// Explicitly propagate context to nested async work
await withSpanContext(parentSpan, async () => {
  const childSpan = tracer.startSpan('validateCart');  // auto-parented
  await validateCart();
  childSpan.end();
});

parentSpan.end();
```

---

### 3.18 Dev Tooling & Debugging

#### 3.18.1 Debug Mode Console Output

When `config.debug: true`, the SDK should log all telemetry events to the React Native console (Metro / Flipper / Logcat / Xcode console) in a human-readable format:

```
[EDOT] Span started: HTTP GET https://api.example.com/users (spanId: abc123)
[EDOT] Span ended: HTTP GET https://api.example.com/users — 200 OK (342ms)
[EDOT] Navigation: HomeScreen → ProductDetail
[EDOT] JS Error captured: TypeError: Cannot read property 'name' of undefined
[EDOT] Session started: session_id=def456
```

#### 3.18.2 Flipper Plugin (Optional, Phase 5+)

A Flipper plugin that visualizes telemetry in real-time during development:

- Live span waterfall view.
- Network request list with trace IDs.
- Error log viewer.
- Session attribute inspector.

This is a nice-to-have for post-MVP, but extremely helpful for developer adoption.

#### 3.18.3 Telemetry Export Dry-Run

For debugging telemetry pipeline issues, the SDK should support exporting to console instead of (or in addition to) the OTLP endpoint:

```typescript
await EdotReactNative.initialize({
  ...config,
  debug: true,
  debugExportToConsole: true,  // log OTLP payloads to console
});
```

---

### 3.19 View-to-Network Span Correlation (Screen → API Mapping)

A core observability need is answering: "When the user is on Screen X, which API calls fire?" Without explicit correlation, view spans and network spans are flat siblings under the same session — queryable only by overlapping timestamps, not by structural relationship.

#### 3.19.1 Design Approach — Span Links (Not Parent-Child)

Network spans are **linked** to the active view span, not made children of it. This is intentional:

- **Parent-child** would mean the view span cannot end until all child network spans end. If a user navigates away while a slow API request is still in-flight, the previous view span would hang open, corrupting navigation timing data.
- **Span links** allow independent lifetimes. The view span ends on navigation; the network span ends when the response arrives. The link preserves the relationship without coupling their lifecycles.

#### 3.19.2 Active View Context — Shared State

The navigation plugins (React Navigation, Wix, Expo Router) manage a shared `ActiveViewContext` that the network interceptor reads:

```typescript
// packages/core/src/context/ActiveViewContext.ts

import { SpanContext } from './types';

let activeViewContext: SpanContext | null = null;
let activeViewName: string | null = null;

export function setActiveView(spanContext: SpanContext, viewName: string) {
  activeViewContext = spanContext;
  activeViewName = viewName;
}

export function clearActiveView() {
  activeViewContext = null;
  activeViewName = null;
}

export function getActiveViewContext(): SpanContext | null {
  return activeViewContext;
}

export function getActiveViewName(): string | null {
  return activeViewName;
}
```

Navigation plugins call `setActiveView()` when a new screen appears and `clearActiveView()` is NOT called on navigation — the new view simply replaces the old one. This ensures there's always an active view context (except before the first screen renders).

#### 3.19.3 Network Interceptor Integration

The fetch/XHR interceptor reads the active view context and attaches it to every network span:

```typescript
// Inside fetchPatch.ts — when creating a network span

const activeView = getActiveViewContext();
const activeViewName = getActiveViewName();

const span = tracer.startSpan(`HTTP ${method}`, {
  kind: SpanKind.CLIENT,
  attributes: {
    'http.method': method,
    'http.url': sanitizedUrl,
    // View correlation attributes
    ...(activeViewName && { 'view.name': activeViewName }),
    ...(activeView && { 'view.id': activeView.spanId }),
  },
  // Span link to the active view span
  links: activeView ? [{ context: activeView }] : [],
});
```

This produces two correlation mechanisms:

1. **Span link** — structural relationship queryable in Kibana's trace view.
2. **`view.name` and `view.id` attributes** — flat attributes on every network span, enabling simple `GROUP BY view.name` queries and dashboard filters.

#### 3.19.4 Span Attributes Added to Network Spans

| Attribute | Source | Example |
|---|---|---|
| `view.name` | Active navigation screen name | `ProductDetailScreen` |
| `view.id` | Active view span's spanId | `abc123def456` |
| Span Link | OTel link to view span context | `traceId + spanId` of view span |

#### 3.19.5 Querying in Kibana

With these attributes and links, the following queries become possible:

**"Which APIs does ProductDetailScreen call?"**
```
span.type: "http" AND view.name: "ProductDetailScreen"
```

**"Which screen triggered this slow API call?"**
```
span.name: "HTTP GET /api/recommendations" → read view.name attribute → "HomeScreen"
```

**"Show me the full waterfall for a screen visit"**
Navigate to any view span in Kibana APM → follow span links → see all network requests, errors, and custom spans that occurred during that view.

**"Which screen has the most API calls?"**
```
GROUP BY view.name, COUNT(span.type: "http") ORDER BY count DESC
```

**"Which screen has the slowest cumulative API time?"**
```
GROUP BY view.name, SUM(http.duration) ORDER BY sum DESC
```

#### 3.19.6 Error Span Correlation

The same pattern applies to JS error spans. When a JS error is captured, the active view context is attached:

```typescript
// Inside reportJsError()
const activeViewName = getActiveViewName();

const span = tracer.startSpan('JS Error', {
  attributes: {
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack,
    'error.source': source,
    ...(activeViewName && { 'view.name': activeViewName }),
  },
  links: getActiveViewContext() ? [{ context: getActiveViewContext()! }] : [],
});
```

This enables: "Which screen has the most errors?" and "What errors occur on the checkout screen?"

#### 3.19.7 Custom Span Correlation

Manual instrumentation spans (via TracerProvider) also receive the active view context automatically if `autoLinkToActiveView` is not disabled:

```typescript
// In TracerProvider wrapper — startSpan override
startSpan(name: string, options?: SpanOptions): Span {
  const activeView = getActiveViewContext();
  const existingLinks = options?.links ?? [];

  const enrichedOptions = {
    ...options,
    attributes: {
      ...options?.attributes,
      ...(getActiveViewName() && { 'view.name': getActiveViewName() }),
    },
    links: activeView
      ? [...existingLinks, { context: activeView }]
      : existingLinks,
  };

  return originalStartSpan(name, enrichedOptions);
}
```

This means custom business logic spans (e.g., `processPayment`) are also linked to the screen where they were triggered — without the developer doing anything extra.

---

## 4. Native Module Implementation Guide

### 4.1 iOS Native Module

#### 4.1.1 File Structure

```
ios/
├── EdotReactNative.swift                 # Main native module
├── EdotReactNative.m                     # ObjC bridge header (for old arch)
├── EdotReactNativeSpec.h                 # TurboModule codegen spec
├── EdotReactNativeAgent.swift            # Pre-initialization API
├── EdotBridgeHelpers.swift               # JS ↔ Native type conversions
├── EdotReactNative.podspec               # CocoaPods podspec
└── generated/                            # TurboModule codegen output
```

#### 4.1.2 Podspec Dependencies

```ruby
Pod::Spec.new do |s|
  s.name         = 'EdotReactNative'
  s.version      = '0.1.0'
  s.platform     = :ios, '16.0'

  s.dependency 'React-Core'
  s.dependency 'ElasticApm', '~> 2.0'       # EDOT iOS SDK
  # ElasticApm brings in:
  #   - opentelemetry-swift ~> 1.16.0
  #   - plcrashreporter ~> 1.12.0
  #   - Reachability.swift ~> 5.2.4
  #   - Kronos ~> 4.2.2
end
```

#### 4.1.3 Key Bridge Methods (exposed to JS)

```swift
@objc(EdotReactNative)
class EdotReactNative: NSObject {

  @objc func initialize(_ config: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock)

  @objc func getCurrentSessionId(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock)

  @objc func setUser(_ userInfo: NSDictionary)
  @objc func clearUser()

  @objc func setSessionAttribute(_ key: String, value: String)
  @objc func setGlobalAttribute(_ key: String, value: String)
  @objc func removeGlobalAttribute(_ key: String)

  @objc func reportJsException(_ errorInfo: NSDictionary)

  @objc func startSpan(_ name: String, attributes: NSDictionary, parentSpanId: String?) -> String  // returns spanId
  @objc func endSpan(_ spanId: String, statusCode: Int)
  @objc func setSpanAttribute(_ spanId: String, key: String, value: Any)
  @objc func recordSpanException(_ spanId: String, errorInfo: NSDictionary)

  @objc func recordMetric(_ name: String, value: Double, attributes: NSDictionary, metricType: String)

  @objc func emitLog(_ severity: String, message: String, attributes: NSDictionary)
}
```

### 4.2 Android Native Module

#### 4.2.1 File Structure

```
android/
├── src/main/
│   ├── java/com/edot/reactnative/
│   │   ├── EdotReactNativeModule.kt         # Main native module
│   │   ├── EdotReactNativePackage.kt        # RN package registration
│   │   ├── EdotReactNativeAgent.kt          # Pre-initialization API
│   │   ├── EdotBridgeHelpers.kt             # JS ↔ Native type conversions
│   │   └── EdotTurboModule.kt               # TurboModule implementation (new arch)
│   └── AndroidManifest.xml
├── build.gradle.kts
└── generated/                                # TurboModule codegen output
```

#### 4.2.2 Gradle Dependencies

```kotlin
dependencies {
    implementation("com.facebook.react:react-android")
    implementation("co.elastic.otel.android:agent:+")        // EDOT Android SDK
    implementation("co.elastic.otel.android:instrumentation-okhttp:+")
    // EDOT Android brings in:
    //   - io.opentelemetry:opentelemetry-api
    //   - io.opentelemetry:opentelemetry-sdk
    //   - io.opentelemetry:opentelemetry-exporter-otlp
}
```

The app's `build.gradle.kts` must also apply the EDOT Gradle plugin:

```kotlin
plugins {
    id("com.android.application")
    id("co.elastic.otel.android.agent") version "X.Y.Z"
}
```

#### 4.2.3 Key Bridge Methods (exposed to JS)

```kotlin
class EdotReactNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @ReactMethod fun initialize(config: ReadableMap, promise: Promise)
    @ReactMethod fun getCurrentSessionId(promise: Promise)
    @ReactMethod fun setUser(userInfo: ReadableMap)
    @ReactMethod fun clearUser()
    @ReactMethod fun setSessionAttribute(key: String, value: String)
    @ReactMethod fun setGlobalAttribute(key: String, value: String)
    @ReactMethod fun removeGlobalAttribute(key: String)
    @ReactMethod fun reportJsException(errorInfo: ReadableMap)
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun startSpan(name: String, attributes: ReadableMap, parentSpanId: String?): String
    @ReactMethod fun endSpan(spanId: String, statusCode: Int)
    @ReactMethod fun setSpanAttribute(spanId: String, key: String, value: Dynamic)
    @ReactMethod fun recordSpanException(spanId: String, errorInfo: ReadableMap)
    @ReactMethod fun recordMetric(name: String, value: Double, attributes: ReadableMap, metricType: String)
    @ReactMethod fun emitLog(severity: String, message: String, attributes: ReadableMap)
}
```

### 4.3 TurboModule Spec (New Architecture)

For New Architecture support, define a shared TurboModule spec:

```typescript
// src/NativeEdotReactNative.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  initialize(config: Object): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  setUser(userInfo: Object): void;
  clearUser(): void;
  setSessionAttribute(key: string, value: string): void;
  setGlobalAttribute(key: string, value: string): void;
  removeGlobalAttribute(key: string): void;
  reportJsException(errorInfo: Object): void;
  startSpan(name: string, attributes: Object, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  recordSpanException(spanId: string, errorInfo: Object): void;
  recordMetric(name: string, value: number, attributes: Object, metricType: string): void;
  emitLog(severity: string, message: string, attributes: Object): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EdotReactNative');
```

The module loader in JS should conditionally import TurboModule or fallback to NativeModules:

```typescript
// src/nativeModule.ts
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const EdotNativeModule = isTurboModuleEnabled
  ? require('./NativeEdotReactNative').default
  : require('react-native').NativeModules.EdotReactNative;

export default EdotNativeModule;
```

---

## 5. DataDog Migration Guide

### 5.1 API Mapping — DataDog → EDOT RN SDK

| DataDog API | EDOT RN Equivalent | Notes |
|---|---|---|
| `DdSdkReactNative.initialize(config)` | `EdotReactNative.initialize(config)` | Different config shape, same concept |
| `config.applicationId` | Not needed | Elastic uses `serviceName` instead |
| `config.clientToken` | `config.secretToken` or `config.apiKey` | Auth mechanism differs |
| `config.env` | `config.deploymentEnvironment` | Renamed |
| `config.sessionSamplingRate` (0–100) | `config.sessionSamplingRate` (0.0–1.0) | Different scale |
| `config.trackErrors` | `config.instrumentJsErrors` | Renamed |
| `config.nativeCrashReportEnabled` | `config.instrumentNativeCrashes` | Renamed |
| `config.firstPartyHosts` | `config.tracePropagationTargets` | Supports regex |
| `DdRumReactNavigationTracking.startTrackingViews(ref)` | `createEdotNavigationContainerRef()` | Different pattern, same result |
| `DdSdkReactNative.setUser({id, email, name})` | `EdotReactNative.setUser({id, email, name})` | Same shape |
| `DdSdkReactNative.setAttributes({key: value})` | `EdotReactNative.setGlobalAttribute(key, value)` | Per-key instead of batch |
| `DdLogs.debug/info/warn/error(msg, ctx)` | `EdotReactNative.log(severity, msg, ctx)` | Unified method |
| `DdTrace.startSpan(name)` | `tracer.startSpan(name)` | OTel-standard API |
| `DdTrace.finishSpan(spanId)` | `span.end()` | Object-oriented instead of ID-based |
| RUM Event Mappers | `addSpanExporterInterceptor()` | Native-level interceptor |
| `trackingConsent: 'granted'` | `trackingConsent: 'granted'` | Same concept, same values |
| `DdRum.addAction(type, name, ctx)` | `EdotReactNative.addAction(type, name, ctx)` | Same API shape |
| `config.firstPartyHosts[].propagatorTypes` | `config.tracePropagationTargets` | W3C only (no Datadog-specific headers) |
| `DdSdkReactNative.setAttributes({batch})` | `EdotReactNative.setGlobalAttribute(k, v)` per key | No batch setter — use loop |

### 5.2 Migration Checklist

1. Remove `@datadog/mobile-react-native` and all `@datadog/mobile-react-*` packages.
2. Remove DataDog iOS pod (`DatadogSDKObjc`, `DatadogSDKBridge`) and Android dependencies.
3. Install `@inox-edot/react-native` and relevant navigation plugin.
4. Update `Podfile` to include EDOT iOS dependency. Run `pod install`.
5. Update `android/build.gradle.kts` to apply EDOT Gradle plugin.
6. Replace `DdSdkReactNative.initialize()` with `EdotReactNative.initialize()` — translate config.
7. Replace navigation tracking setup with EDOT navigation plugin.
8. Replace `DdLogs.*` calls with `EdotReactNative.log()`.
9. Replace `DdTrace.startSpan/finishSpan` with OTel tracer API.
10. Update any global attributes / user tracking calls.
11. Verify telemetry appears in Kibana APM dashboard.
12. Remove any remaining DataDog-specific code (event mappers, custom actions, etc.).

---

## 6. Expo Support

### 6.1 Expo Config Plugin

For Expo managed workflow (`expo prebuild`), provide a config plugin that automates native setup:

```json
// app.json
{
  "expo": {
    "plugins": [
      ["@inox-edot/react-native", {
        "ios": {
          "serverUrl": "https://apm.example.com:8200"
        },
        "android": {
          "serverUrl": "https://apm.example.com:8200",
          "gradlePluginVersion": "1.5.0"
        }
      }]
    ]
  }
}
```

The config plugin must:

- **iOS**: Modify `AppDelegate.swift` to add `EdotReactNativeAgent.preInitialize(...)` call. Add `ElasticApm` pod to Podfile.
- **Android**: Add EDOT Gradle plugin to `build.gradle.kts`. Add `EdotReactNativeAgent.preInitialize(...)` to `MainApplication.kt`.

### 6.2 Expo Router Integration

The `@inox-edot/react-native-expo-router` package already handles Expo Router navigation tracking (Section 3.3.4).

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Area | Tool | Coverage Target |
|---|---|---|
| JS fetch/XHR instrumentation | Jest | Verify spans created with correct attributes |
| JS error handler | Jest | Verify errors caught and reported |
| Config validation | Jest | Verify invalid configs throw helpful errors |
| Navigation state change → span | Jest | Verify screen name extraction per library |
| TracerProvider wrapper | Jest | Verify OTel API compliance |
| Type definitions | TypeScript compiler | 100% strict mode compliance |

### 7.2 Integration Tests

| Area | Tool | Purpose |
|---|---|---|
| iOS native module | XCTest | Verify EDOT iOS init and span forwarding |
| Android native module | JUnit/Espresso | Verify EDOT Android init and span forwarding |
| E2E trace export | Detox + mock OTLP server | Verify full pipeline: JS action → span → OTLP export |
| Session management | Detox | Verify session ID consistency across lifecycle |
| Crash capture | Detox (with crash scenario) | Verify crash report uploaded on next launch |

### 7.3 Example App

A monorepo example app that demonstrates:

- Full SDK initialization with all features enabled.
- Navigation tracking with `@react-navigation/native`.
- Custom spans for a checkout flow.
- Custom metrics for business events.
- Error boundary usage.
- User identification.
- All three navigation libraries (separate example screens/flows).

---

## 8. Build & CI/CD

### 8.1 Monorepo Tooling

| Tool | Purpose |
|---|---|
| Yarn Workspaces or pnpm | Monorepo package management |
| TypeScript | Strict mode, project references |
| Bob (react-native-builder-bob) | Library build tooling (CommonJS + ESM + types) |
| ESLint + Prettier | Code quality |
| Jest | Unit testing |
| Detox | E2E integration testing |
| Changesets | Version management and changelogs |
| GitHub Actions | CI pipeline |

### 8.2 CI Pipeline

1. **Lint & Type Check**: ESLint + `tsc --noEmit` on every PR.
2. **Unit Tests**: Jest on every PR.
3. **Build**: `bob build` to verify all packages compile.
4. **iOS Integration**: Build example app on macOS runner, run XCTest suite.
5. **Android Integration**: Build example app on Linux runner, run JUnit suite.
6. **E2E (nightly)**: Full Detox suite against mock OTLP server.
7. **Release**: Changesets-based release to npm on merge to `main`.

---

## 9. Phased Delivery Plan

### Phase 1 — Foundation (Weeks 1–3)

- Monorepo scaffolding (Yarn workspaces, Bob, TypeScript config).
- Core native modules: iOS (Swift) + Android (Kotlin) wrapping EDOT SDK initialization.
- `EdotReactNative.initialize()` with full config support.
- Session management bridge (getCurrentSessionId, setUser).
- TurboModule + legacy bridge dual support.
- Basic unit tests and example app shell.

### Phase 2 — Auto-Instrumentation (Weeks 4–6)

- Fetch + XHR monkey-patching with span creation.
- W3C trace context propagation.
- GraphQL operation name extraction for `graphqlUrls`.
- URL sanitization (default query param stripping + custom `urlSanitizer`).
- JS error handler (global errors + unhandled promise rejections).
- `EdotErrorBoundary` component.
- Native crash forwarding verification (EDOT native handles this; verify it works in RN context).
- AppState lifecycle tracking.
- App startup tracing (cold/warm start spans).
- Deduplication of JS vs native network spans.
- Orphaned span cleanup timer.
- Graceful degradation (no-op fallback when native module missing).

### Phase 3 — View-to-Network Span Correlation (Week 7)

- `ActiveViewContext` module (`setActiveView`, `getActiveViewContext`, `getActiveViewName`).
- Network interceptor integration: add `view.name`, `view.id` attributes and OTel span links to every fetch/XHR span.
- Error handler integration: add `view.name` and span link to every JS error span.
- TracerProvider integration: auto-link custom spans to active view (with `autoLinkToActiveView` opt-out).
- Export `setActiveView` from core package for navigation plugins to consume in Phase 4.
- Unit tests for all correlation scenarios (active view, no view, navigation during in-flight request).

### Phase 4 — Navigation, Consent & Manual APIs (Weeks 8–10)

- `@inox-edot/react-native-navigation` (React Navigation) with `screenNameMapper` — calls `setActiveView()` on every screen change.
- `@inox-edot/react-native-wix-navigation` (Wix) — calls `setActiveView()` on ComponentDidAppear.
- `@inox-edot/react-native-expo-router` (Expo Router) — calls `setActiveView()` on pathname change.
- `@inox-edot/react-native-tracer-provider` (manual spans, metrics, logs, `withSpanContext`).
- Tracking consent API (`granted` / `pending` / `not_granted`) with buffer/flush/purge.
- User interaction tracking (`addAction`, `withEdotTracking` HOC).
- Global attributes API.
- Session attributes API.
- iOS background flush (`beginBackgroundTask`) + disk cache.

### Phase 5 — Polish, Symbolication & Migration (Weeks 11–14)

- `edot-rn-sourcemap-upload` CLI tool (JS source maps, ProGuard mapping, iOS dSYM upload).
- CodePush/OTA version support and composite version source map upload.
- Gradle task and Xcode build phase integration for automated symbol upload.
- DataDog migration guide with code examples.
- Expo config plugin.
- Debug mode console output and `debugExportToConsole`.
- E2E test suite with Detox.
- Performance benchmarking (startup time impact, memory overhead, battery drain).
- Documentation: README, API reference, integration guide, GDPR compliance notes.
- npm publish pipeline with Changesets.
- Security review (no PII in default telemetry, token handling, consent flow audit).

### Phase 6 — Post-MVP Enhancements (Backlog)

- Flipper plugin for real-time telemetry visualization.
- Request/response body capture (opt-in, with size limits).
- W3C Baggage propagation alongside traceparent.
- Network timing breakdown (DNS, TLS, TTFB — requires native bridge).
- Rage tap / dead tap detection (frustration signals).
- Redux state change tracking plugin (`@inox-edot/react-native-redux`).

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| EDOT native SDK API breaks between versions | Medium | High | Pin to specific EDOT SDK versions, test upgrades in CI |
| Dual architecture support complexity | High | Medium | Use react-native-builder-bob which handles codegen; test on both archs in CI |
| fetch/XHR patching conflicts with other SDKs | Medium | Medium | Apply patches early (at init), provide escape hatch to disable |
| Session ID mismatch between JS and native | Low | High | Always read session ID from native; never generate in JS |
| Large telemetry volume impacts app performance | Medium | High | Default session sampling at 1.0 but document recommended production rate (0.1–0.5); batch exports; disk buffering on Android |
| Expo config plugin breaks on Expo SDK updates | Medium | Low | Test against latest Expo SDK in CI; scope Expo support as best-effort |
| Obfuscated stack traces in production | High | High | Ship `edot-rn-sourcemap-upload` CLI; integrate symbol upload into Gradle/Xcode build phases; document in setup guide as mandatory step for production |
| Hermes bytecode source maps differ from Metro bundle maps | Medium | Medium | Test CLI against both Hermes `.hbc.map` and Metro `.jsbundle.map` formats; detect format automatically |
| iOS telemetry lost on background/kill | High | Medium | Implement `beginBackgroundTask` flush + local disk cache; document limitation |
| CodePush/OTA version mismatch with source maps | Medium | High | Support composite `serviceVersion+codePushVersion`; document OTA source map upload in CI |
| SDK initialization crashes host app | Low | Critical | Wrap all SDK code in try-catch; provide no-op fallback if native module missing |
| GDPR non-compliance if PII leaks into telemetry | Medium | Critical | Default URL sanitization strips query params; header capture is opt-in allowlist only; provide `urlSanitizer` callback |
| Orphaned spans cause memory leaks | Medium | Medium | Periodic cleanup of spans older than 5 minutes; auto-end view spans on navigation |
| View context stale during navigation transition | Low | Medium | Replace `activeViewContext` atomically in `setActiveView()`; network spans during the brief transition gap (~16ms) link to the old view, which is acceptable |

---

## 11. Success Criteria

1. **Feature Parity**: All DataDog RN SDK features the client uses are available (network, navigation, errors, crashes, sessions, user actions, manual instrumentation).
2. **Telemetry Visibility**: All three signal types (traces, metrics, logs) appear correctly in Kibana APM.
3. **Distributed Tracing**: `traceparent` header is propagated and backend spans are linked to mobile spans.
4. **Crash Reliability**: Both JS and native crashes are captured and uploaded on next launch, with full symbolicated stack traces.
5. **Performance**: SDK initialization adds <100ms to app startup. Runtime overhead is <2% CPU and <5MB memory.
6. **Migration Time**: A team familiar with DataDog RN SDK can migrate in <2 developer-days using the migration guide.
7. **CI Green**: All tests pass on RN 0.72, 0.73, and 0.76 (latest) across both architectures.
8. **Privacy**: No PII in default telemetry. URL query params stripped by default. Headers not captured unless allowlisted. Consent API works correctly for all three states.
9. **Resilience**: SDK never crashes the host app. Missing native module degrades gracefully. Orphaned spans are auto-cleaned.
10. **Offline**: Android disk buffering works. iOS background flush completes before suspension.
11. **View-API Correlation**: Every network span and error span includes `view.name` + `view.id` attributes and a span link to the active view. Kibana query `view.name: "ScreenX"` returns all APIs called from that screen.

---

## Appendix A: Reference Implementations Reviewed

| SDK | Key Takeaway for Our Design |
|---|---|
| EDOT iOS (apm-agent-ios v2.0) | AgentConfigBuilder pattern, PLCrashReporter integration, MetricKit spans, session-based sampling |
| EDOT Android (apm-agent-android) | Gradle plugin for bytecode instrumentation, OkHttp interceptor, ANR detection, disk buffering |
| callstack/react-native-open-telemetry | Dual JS+native OTel SDK approach; limitation: no bidirectional bridge communication — we must solve this |
| embrace-io/embrace-react-native-sdk | Best-in-class monorepo structure, separate tracer-provider package, navigation plugins per library, OTLP export package — strong architectural reference |
| DataDog/dd-sdk-reactnative | Migration source; fetch/XHR patching, navigation tracking API, native crash bridging — our API should feel familiar to DataDog users |

## Appendix B: OpenTelemetry Semantic Conventions Reference

All span and resource attributes should follow the OpenTelemetry Semantic Conventions v1.25+:

- HTTP: https://opentelemetry.io/docs/specs/semconv/http/
- Mobile: https://opentelemetry.io/docs/specs/semconv/resource/device/
- Exceptions: https://opentelemetry.io/docs/specs/semconv/exceptions/
- Session: https://opentelemetry.io/docs/specs/semconv/general/session/

## Appendix C: Glossary

| Term | Definition |
|---|---|
| EDOT | Elastic Distribution of OpenTelemetry |
| OTLP | OpenTelemetry Protocol (wire format for exporting telemetry) |
| APM | Application Performance Monitoring |
| RUM | Real User Monitoring |
| ANR | Application Not Responding (Android-specific freeze detection) |
| JSI | JavaScript Interface (React Native New Architecture's native bridge) |
| PLCrashReporter | iOS crash reporting framework used by EDOT iOS |
| W3C Trace Context | Standard for propagating trace IDs across service boundaries |
| Span | A unit of work in a distributed trace |
| TracerProvider | OTel factory that creates Tracer instances |
