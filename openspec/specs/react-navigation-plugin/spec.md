# react-navigation-plugin

## Purpose

Integrates with React Navigation to automatically create screen-lifetime spans on screen transitions and maintain the ActiveViewContext, enabling network and error spans to be correlated to the current screen.

## Requirements

### Requirement: React Navigation container ref factory
The SDK SHALL provide `createEdotNavigationContainerRef()` returning an object with `navigationRef`, `onReady`, `onStateChange`, and `cleanup`. The ref SHALL be passed to `<NavigationContainer ref={navigationRef}>`. The function SHALL accept an optional `screenNameMapper: (routeName: string, params?: Record<string, unknown>) => string` callback for PII redaction or screen-name normalization.

#### Scenario: Container ref creation
- **WHEN** `createEdotNavigationContainerRef()` is called
- **THEN** it returns an object containing `{ navigationRef, onReady, onStateChange, cleanup }`

#### Scenario: Screen name mapper applied
- **WHEN** `createEdotNavigationContainerRef({ screenNameMapper: (name) => name.replace(/\d+/, ':id') })` is used
- **AND** user navigates to `UserProfile/42`
- **THEN** the screen-lifetime span name SHALL be `"UserProfile/:id"`
- **AND** `screen.name` SHALL be `"UserProfile/:id"`

### Requirement: View span creation on navigation state change
The plugin SHALL listen for navigation state changes via `onStateChange` on the container ref. On each state change, it SHALL end the previous screen-lifetime span and start a new one with span name equal to the screen name (after any `screenNameMapper` transformation) and attributes `screen.name` and (when applicable) `last.screen.name`. The span SHALL be started with `instrumentationName = "@inox/react-native-edot-navigation"`.

#### Scenario: Screen transition creates span
- **WHEN** user navigates from `HomeScreen` to `ProductDetail`
- **THEN** the `HomeScreen` screen-lifetime span SHALL end with status OK
- **AND** a new span named `"ProductDetail"` SHALL be created
- **AND** the span SHALL have `screen.name = "ProductDetail"`
- **AND** the span SHALL have `last.screen.name = "HomeScreen"`
- **AND** the span SHALL be started with `instrumentationName = "@inox/react-native-edot-navigation"`

#### Scenario: Initial screen creates first span
- **WHEN** the app starts and the navigation container mounts with initial route `HomeScreen`
- **THEN** a span named `"HomeScreen"` SHALL be created
- **AND** the span SHALL NOT include `last.screen.name`
- **AND** the span SHALL NOT include any attribute named `view.transition_type`

### Requirement: ActiveViewContext integration
The plugin SHALL call `ActiveViewContext.setActiveView()` on each screen transition so that network and error spans can correlate to the current screen.

#### Scenario: Active view updated on navigation
- **WHEN** user navigates to `ProductDetail`
- **THEN** `ActiveViewContext.getActiveView()` returns `{ name: 'ProductDetail', spanId: '<spanId>' }`

### Requirement: Foreground re-emit
The plugin SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` at construction. The re-emitter SHALL reset the plugin's `previousScreenName` module-state field to `null`, then read the current screen via `navigationRef.current.getCurrentRoute()`, then start a new screen-lifetime span using the same code path as initial emission.

#### Scenario: Foreground replays current route
- **GIVEN** the navigation container's current route is `"Home"` (per `navigationRef.current.getCurrentRoute()`)
- **AND** the SDK's AppState handler invokes registered foreground re-emitters
- **WHEN** the React Navigation plugin's re-emitter runs
- **THEN** a new span named `"Home"` SHALL be created
- **AND** the span SHALL have `screen.name = "Home"`
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground with detached navigationRef
- **GIVEN** `navigationRef.current` is `null` at the time of foreground re-emit
- **WHEN** the re-emitter runs
- **THEN** no span SHALL be created
- **AND** no exception SHALL be thrown

### Requirement: Cleanup on unmount
The `cleanup()` function SHALL end the current view span, clear the active view context, and call the unregister function returned by `ActiveViewContext.registerForegroundReEmitter(...)`.

#### Scenario: Navigation container unmounts
- **WHEN** the `NavigationContainer` unmounts
- **THEN** the current view span ends
- **AND** `ActiveViewContext.getActiveView()` returns `null`
- **AND** the plugin's foreground re-emitter SHALL be unregistered from `ActiveViewContext`
- **AND** subsequent foreground events SHALL NOT invoke this plugin's re-emitter
