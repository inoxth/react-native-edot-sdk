# Navigation Tracking Specification

## Purpose
Track screen transitions as OpenTelemetry spans for each supported navigation library, with attribute names aligned to the Elastic mobile spec / opentelemetry-android upstream conventions.

## Requirements

### General
- MUST create one screen-lifetime span per screen visit, with attributes:
  - `screen.name` — current screen identity (after any `screenNameMapper` transformation)
  - `last.screen.name` — only when a prior screen exists and differs from the new screen (omitted on first emission and on app-foreground re-emit)
- MUST end the previous screen-lifetime span when a new screen appears or when the SDK's app-state handler reports `'background'`
- MUST set the span name to the plain screen name (no `"Navigation: "` prefix)
- MUST set span kind to `INTERNAL` (default)
- MUST pass a per-plugin `instrumentationName` to `EdotNativeModule.startSpan(...)` so spans carry distinguishable `instrumentation.scope.name`
- MUST NOT emit the legacy `view.name` / `view.previous` / `view.transition_type` / `view.url` attributes
- SHOULD accept a `screenNameMapper` callback to redact PII from screen names
- MUST be implemented as separate optional packages per navigation library
- MUST register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` so the SDK's app-state listener can re-emit the current screen on foreground (treated as fresh visit; `last.screen.name` omitted)

### React Navigation (@react-navigation/native)
- MUST provide `createEdotNavigationContainerRef()` returning `{ navigationRef, onReady, onStateChange, cleanup }`
- MUST extract current route name via `navigationRef.getCurrentRoute()`
- Tracer scope: `"@inox/react-native-edot-navigation"`

### Wix react-native-navigation
- MUST provide `registerEdotNavigationListener(Navigation)` that hooks into `ComponentDidAppear` events
- MUST extract component name from the event
- MUST stash the most recent `ComponentDidAppear` event in module state for foreground replay
- Tracer scope: `"@inox/react-native-edot-wix-navigation"`

### Expo Router
- MUST provide `<EdotExpoNavigationProvider>` wrapper component
- MUST use `usePathname()` to detect route changes
- Tracer scope: `"@inox/react-native-edot-expo-router"`

### Scenarios

#### Scenario: React Navigation screen change
- **Given** the navigation container uses `createEdotNavigationContainerRef()`
- **When** user navigates from HomeScreen to ProductDetail
- **Then** the HomeScreen view span ends with status OK
- **And** a new span named `ProductDetail` is created (no `"Navigation: "` prefix)
- **And** `screen.name` is set to `ProductDetail`
- **And** `last.screen.name` is set to `HomeScreen`
- **And** the span carries `instrumentation.scope.name = "@inox/react-native-edot-navigation"`

#### Scenario: Initial screen omits last.screen.name
- **When** the very first screen-lifetime span is created
- **Then** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground re-emit treats screen as fresh visit
- **Given** the app was on screen `Home` when backgrounded
- **When** the app foregrounds back to `Home`
- **Then** a new span SHALL be created with `screen.name = "Home"` and a fresh `screen.id`
- **And** the new span SHALL NOT include `last.screen.name`
