## MODIFIED Requirements

### Requirement: View span creation on ComponentDidAppear
The plugin SHALL create a screen-lifetime span on each `ComponentDidAppear` event whose `componentName` differs from the previously-emitted screen. It SHALL end the previous span and create a new one with span name equal to the component name (after any `screenNameMapper` transformation), with attributes `screen.name` and (when applicable) `last.screen.name`. The span SHALL be started with `instrumentationName = "@inox/react-native-edot-wix-navigation"`. The plugin SHALL also stash the most recent `ComponentDidAppear` event in module state so it is available to the foreground re-emitter.

#### Scenario: Component appears creates span
- **WHEN** `ComponentDidAppear` fires with `componentName: "CartScreen"`
- **AND** the previous screen was `"HomeScreen"`
- **THEN** the `HomeScreen` screen-lifetime span SHALL end
- **AND** a new span named `"CartScreen"` SHALL be created
- **AND** the span SHALL have `screen.name = "CartScreen"`
- **AND** the span SHALL have `last.screen.name = "HomeScreen"`
- **AND** the span SHALL be started with `instrumentationName = "@inox/react-native-edot-wix-navigation"`

#### Scenario: Duplicate component event is suppressed
- **GIVEN** the previous screen is `"CartScreen"`
- **WHEN** `ComponentDidAppear` fires with `componentName: "CartScreen"`
- **THEN** no new span SHALL be created
- **AND** the existing span SHALL remain active

#### Scenario: Screen name mapper applied
- **WHEN** options include `screenNameMapper: (name) => name.replace('Screen', '')`
- **AND** `ComponentDidAppear` fires with `componentName: "CartScreen"`
- **THEN** the span name SHALL be `"Cart"`
- **AND** `screen.name` SHALL be `"Cart"`

## ADDED Requirements

### Requirement: Foreground re-emit replays last event
The plugin SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` when `registerEdotNavigationListener(Navigation, options?)` is called. The re-emitter SHALL reset the plugin's `previousScreenName` module-state field to `null`, then if a `ComponentDidAppear` event has been observed since registration, replay it by re-running the same code path used for live `ComponentDidAppear` handling.

#### Scenario: Foreground replays last component
- **GIVEN** the most recent `ComponentDidAppear` event has `componentName: "Home"`
- **AND** the SDK's AppState handler invokes registered foreground re-emitters
- **WHEN** the Wix plugin's re-emitter runs
- **THEN** a new span named `"Home"` SHALL be created
- **AND** the span SHALL have `screen.name = "Home"`
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground without prior event
- **GIVEN** no `ComponentDidAppear` event has been observed since registration
- **WHEN** the re-emitter runs
- **THEN** no span SHALL be created
- **AND** no exception SHALL be thrown

### Requirement: Cleanup unregisters foreground re-emitter and clears stashed event
The cleanup function returned by `registerEdotNavigationListener(...)` SHALL call the unregister function returned by `ActiveViewContext.registerForegroundReEmitter(...)`, end the active span, clear the active view, and clear the stashed last `ComponentDidAppear` event in module state.

#### Scenario: Cleanup
- **WHEN** the cleanup function is called
- **THEN** the foreground re-emitter SHALL be unregistered
- **AND** the stashed last component event SHALL be cleared
- **AND** the active screen-lifetime span SHALL end
- **AND** `ActiveViewContext.getActiveView()` SHALL return `null`

## REMOVED Requirements

### Requirement: Legacy `view.*` attributes on Wix plugin spans
**Reason:** Renamed to `screen.name` and `last.screen.name`; `view.transition_type` removed without replacement.

**Migration:** None required (SDK is unpublished).
