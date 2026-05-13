## Why

Phase 4 of the React Native EDOT SDK delivers the remaining developer-facing capabilities: navigation tracking across the three major React Native navigation libraries, consent-aware telemetry buffering, and manual instrumentation APIs (TracerProvider, MeterProvider, custom spans/metrics). These are required for DataDog migration parity and enable developers to correlate screen views with network requests and add custom business telemetry.

## What Changes

- Add **three navigation plugin packages** (`@inox/react-native-edot-navigation`, `@inox/react-native-edot-wix-navigation`, `@inox/react-native-edot-expo-router`) that create OTel view spans on screen transitions
- Add **ActiveViewContext** shared module in the core package so network and error spans automatically link to the active screen
- Add **`@inox/react-native-edot-tracer-provider`** package exposing `getTracerProvider()`, `getMeterProvider()`, and `withSpanContext()` for custom spans, metrics, and async context propagation
- Add **user interaction helpers**: `withEdotTracking()` HOC and `useEdotAction()` hook for tap/gesture tracking
- Wire navigation plugins into existing network instrumentation (fetch/XHR) and error handler for view-to-network correlation

## Capabilities

### New Capabilities
- `react-navigation-plugin`: React Navigation integration — `createEdotNavigationContainerRef()`, view span creation, `screenNameMapper` support
- `wix-navigation-plugin`: Wix react-native-navigation integration — `registerEdotNavigationListener()`, ComponentDidAppear-based span creation
- `expo-router-plugin`: Expo Router integration — `<EdotExpoNavigationProvider>` wrapper using `usePathname()`/`useSegments()` hooks
- `active-view-context`: Shared module tracking the current screen for cross-cutting view correlation on network/error spans
- `tracer-provider`: OTel-compatible TracerProvider/MeterProvider wrapper — custom spans, metrics, async context propagation via `withSpanContext()`
- `user-interactions`: `withEdotTracking()` HOC and `useEdotAction()` hook for tracking user taps and gestures as OTel events

### Modified Capabilities
- `network-instrumentation`: Add `view.name` and `view.id` attributes + span link to active view span on fetch/XHR spans
- `error-tracking`: Add `view.name` attribute to JS error spans from the active view context

## Impact

- **New packages**: 4 new workspace packages (3 navigation plugins + tracer-provider)
- **Core package changes**: Add ActiveViewContext module, wire into fetch/XHR patching and error handler
- **Native bridge**: No new native methods needed — navigation/tracer packages use existing `startSpan`, `endSpan`, `setSpanAttribute`, `recordMetric` bridge methods
- **Dependencies**: Navigation packages will have peer dependencies on their respective navigation libraries (`@react-navigation/native`, `react-native-navigation`, `expo-router`)
- **Example app**: Update to demonstrate navigation tracking and custom spans
