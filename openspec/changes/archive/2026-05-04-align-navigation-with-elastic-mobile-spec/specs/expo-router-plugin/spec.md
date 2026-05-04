## MODIFIED Requirements

### Requirement: View span creation on route change
The provider SHALL create a screen-lifetime span on each pathname change. It SHALL end the previous span and create a new one with span name equal to the pathname (after any `screenNameMapper` transformation), with attributes `screen.name` and (when applicable) `last.screen.name`. The span SHALL be started with `instrumentationName = "@inox/react-native-edot-expo-router"`. The provider SHALL stash the latest pathname in a ref so it is available to the foreground re-emitter.

#### Scenario: Route change creates span
- **WHEN** user navigates from `/home` to `/products/42`
- **THEN** the `/home` screen-lifetime span SHALL end
- **AND** a new span named `"/products/42"` SHALL be created
- **AND** the span SHALL have `screen.name = "/products/42"`
- **AND** the span SHALL have `last.screen.name = "/home"`
- **AND** the span SHALL be started with `instrumentationName = "@inox/react-native-edot-expo-router"`
- **AND** the span SHALL NOT include `view.url` or `view.transition_type`

#### Scenario: Initial pathname creates first span
- **WHEN** `<EdotExpoNavigationProvider>` mounts with initial pathname `"/home"`
- **THEN** a span named `"/home"` SHALL be created
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Screen name mapper applied
- **WHEN** `screenNameMapper` is `(path) => path.replace(/\/\d+/g, '/:id')`
- **AND** user navigates to `/products/42`
- **THEN** the span name SHALL be `"/products/:id"`
- **AND** `screen.name` SHALL be `"/products/:id"`

## ADDED Requirements

### Requirement: Foreground re-emit
The provider SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` on mount. The re-emitter SHALL reset the provider's `previousPathnameRef.current` to `null`, then read the latest stashed pathname, then start a new screen-lifetime span using the same code path as initial emission.

#### Scenario: Foreground replays current pathname
- **GIVEN** the latest stashed pathname is `"/home"`
- **AND** the SDK's AppState handler invokes registered foreground re-emitters
- **WHEN** the Expo Router provider's re-emitter runs
- **THEN** a new span named `"/home"` SHALL be created
- **AND** the span SHALL have `screen.name = "/home"`
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground with no stashed pathname
- **GIVEN** the provider has not yet observed any pathname
- **WHEN** the re-emitter runs
- **THEN** no span SHALL be created

### Requirement: Cleanup unregisters foreground re-emitter
The provider's unmount cleanup SHALL call the unregister function returned by `ActiveViewContext.registerForegroundReEmitter(...)` in addition to ending the active span and clearing context.

#### Scenario: Unmount unregisters
- **WHEN** `<EdotExpoNavigationProvider>` unmounts
- **THEN** the foreground re-emitter SHALL be unregistered from `ActiveViewContext`

## REMOVED Requirements

### Requirement: Legacy `view.*` attributes on Expo Router spans
**Reason:** Renamed to `screen.name` and `last.screen.name`; `view.url` removed (the pathname is the span name and `screen.name` value).

**Migration:** None required (SDK is unpublished).
