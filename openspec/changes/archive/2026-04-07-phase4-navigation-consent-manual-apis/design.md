## Context

The EDOT React Native SDK has Phase 1 (foundation) and Phase 2 (auto-instrumentation) complete. The core package at `packages/react-native/` provides SDK initialization, fetch/XHR patching, JS error handling, lifecycle tracking, startup tracing, session management, tracking consent, and global attributes. All telemetry flows through `EdotNativeModule` which bridges to the native EDOT iOS/Android SDKs via TurboModule.

Phase 4 adds navigation tracking (3 library plugins), an ActiveViewContext for view-to-network correlation, a TracerProvider package for manual instrumentation, and user interaction helpers.

## Goals / Non-Goals

**Goals:**
- Navigation span creation for React Navigation, Wix Navigation, and Expo Router
- View-to-network correlation via shared ActiveViewContext state
- OTel-compatible TracerProvider/MeterProvider for custom spans and metrics
- User interaction tracking via HOC and hook
- Maintain zero native bridge additions (use existing `startSpan`/`endSpan`/`setSpanAttribute`/`recordMetric`)

**Non-Goals:**
- Native UI navigation tracking (UIKit ViewControllers, Android Activities) — handled by native SDKs
- Source map or dSYM symbolication — Phase 5
- Custom OTLP exporter configuration beyond existing config — Phase 5
- Detox E2E test suite — Phase 5

## Decisions

### 1. ActiveViewContext as a singleton module in the core package

**Decision:** Place `ActiveViewContext` in `packages/react-native/src/activeViewContext.ts` as a module-level singleton, not in a separate package.

**Rationale:** Network instrumentation (fetch/XHR) and error handler already live in the core package and need to read the active view. Putting ActiveViewContext in a separate package would create a circular dependency. Navigation plugins write to it; core instrumentations read from it.

**Alternatives considered:**
- Separate `@inox/active-view-context` package: Creates import complexity and potential circular deps since core needs to read it.
- Event emitter pattern: Over-engineering for a simple get/set state.

### 2. Navigation plugins as standalone workspace packages

**Decision:** Three separate packages: `packages/react-native-navigation/`, `packages/react-native-wix-navigation/`, `packages/react-native-expo-router/`.

**Rationale:** Each navigation library is an optional peer dependency. Bundling them in core would force all users to install all navigation libraries. Separate packages follow the DataDog SDK pattern (`@datadog/mobile-react-native-navigation`) which eases migration.

### 3. TracerProvider wraps native bridge, not OTel JS SDK

**Decision:** `@inox/react-native-edot-tracer-provider` provides an OTel-like API surface that delegates to `EdotNativeModule.startSpan`/`endSpan`/`recordMetric`. It does NOT depend on `@opentelemetry/api` or `@opentelemetry/sdk-trace-base`.

**Rationale:** The native SDKs handle span export, sampling, and batching. Bringing in the full OTel JS SDK would duplicate functionality, add ~200KB to the bundle, and create span lifecycle conflicts. The API surface matches OTel conventions so developers familiar with OTel feel at home.

**Alternatives considered:**
- Full `@opentelemetry/sdk-trace-base` integration: Bundle size, dual-export conflicts, unnecessary complexity.
- Exposing only `EdotNativeModule` methods directly: No ergonomic API, no context propagation.

### 4. Async context propagation via explicit passing, not Zone.js

**Decision:** `withSpanContext(parentSpan, asyncFn)` stores the parent span in a module-scoped variable for the duration of the async function. Child spans created within the callback automatically parent to it.

**Rationale:** React Native doesn't support Zone.js or Node.js AsyncLocalStorage. A simple scoped variable works because JS is single-threaded. The explicit `withSpanContext` wrapper makes the parent relationship visible in code.

### 5. Navigation plugins import ActiveViewContext from core via package export

**Decision:** The core package (`@inox/react-native-edot-sdk`) exports `ActiveViewContext` from a subpath: `@inox/react-native-edot-sdk/active-view-context`. Navigation plugins import from this path to update the active view.

**Rationale:** Keeps ActiveViewContext internal to the SDK ecosystem while allowing navigation plugins to set it. The subpath export avoids polluting the main entry point.

### 6. User interaction tracking as part of the core package

**Decision:** `withEdotTracking()` HOC and `useEdotAction()` hook go in `packages/react-native/src/interactions/`. They use the existing `addAction()` method and `ActiveViewContext`.

**Rationale:** These are thin wrappers over existing core functionality. Creating a separate package would be overkill for ~50 lines of code.

## Risks / Trade-offs

**[Risk] Navigation library API changes break plugins** → Each plugin targets a specific major version range. Pin peer dependency to major version (e.g., `@react-navigation/native: >=6.0.0`). Keep plugin logic minimal to reduce surface area.

**[Risk] ActiveViewContext race condition on rapid navigation** → Navigation events on the JS thread are sequential (single-threaded). The last `setActiveView` call wins, which is the correct behavior for rapid tab switches.

**[Risk] TracerProvider API diverges from OTel spec** → Document the subset of OTel API that's supported. Use the same method names and signatures as `@opentelemetry/api` where possible so migration to full OTel is straightforward if needed later.

**[Trade-off] No automatic tap tracking** → `withEdotTracking` requires wrapping components manually. Automatic tracking via `onPress` monkey-patching is fragile and creates noise. The explicit approach is more reliable and aligns with DataDog's manual action API.
