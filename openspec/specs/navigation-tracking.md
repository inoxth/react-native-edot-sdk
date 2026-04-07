# Navigation Tracking Specification

## Purpose
Track screen transitions as OpenTelemetry spans for each supported navigation library.

## Requirements

### General
- MUST create a span for each screen transition with attributes: `view.name`, `view.previous`, `view.transition_type`
- MUST end the previous view span when a new screen appears
- SHOULD accept a `screenNameMapper` callback to redact PII from screen names
- MUST be implemented as separate optional packages per navigation library

### React Navigation (@react-navigation/native)
- MUST provide `createEdotNavigationContainerRef()` that returns a ref + `onStateChange` handler
- MUST extract current route name via `navigationRef.getCurrentRoute()`

### Wix react-native-navigation
- MUST provide `registerEdotNavigationListener(Navigation)` that hooks into ComponentDidAppear events
- MUST extract component name from the event

### Expo Router
- MUST provide `<EdotExpoNavigationProvider>` wrapper component
- MUST use `usePathname()` and `useSegments()` hooks to detect route changes

### Scenarios

#### Scenario: React Navigation screen change
- **Given** the navigation container uses `createEdotNavigationContainerRef()`
- **When** user navigates from HomeScreen to ProductDetail
- **Then** the HomeScreen view span ends
- **And** a new span `Navigation: ProductDetail` is created
- **And** `view.previous` is set to `HomeScreen`