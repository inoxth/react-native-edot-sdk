## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Cleanup unregisters foreground re-emitter
The `cleanup()` function SHALL call the unregister function returned by `ActiveViewContext.registerForegroundReEmitter(...)` in addition to ending the active span and clearing context.

#### Scenario: Cleanup unregisters
- **WHEN** `cleanup()` is called
- **THEN** the plugin's foreground re-emitter SHALL be unregistered from `ActiveViewContext`
- **AND** subsequent foreground events SHALL NOT invoke this plugin's re-emitter

## REMOVED Requirements

### Requirement: Legacy `view.*` attributes on React Navigation spans
**Reason:** Renamed to `screen.name` and `last.screen.name`; `view.transition_type` removed without replacement.

**Migration:** None required (SDK is unpublished).
