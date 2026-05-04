# expo-router-plugin

## Purpose

Integrates with Expo Router to automatically create screen-lifetime spans on route changes and maintain the ActiveViewContext, enabling network and error spans to be correlated to the current screen.

## Requirements

### Requirement: Expo Router navigation provider
The SDK SHALL provide `<EdotExpoNavigationProvider>` React component that wraps the app's content. It SHALL use `usePathname()` from `expo-router` to detect route changes. It SHALL accept an optional `screenNameMapper` prop.

#### Scenario: Provider wraps app
- **WHEN** `<EdotExpoNavigationProvider>` wraps the app layout
- **THEN** it monitors pathname changes via `usePathname()`

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

### Requirement: ActiveViewContext integration
The provider SHALL call `ActiveViewContext.setActiveView()` on each route change.

#### Scenario: Active view updated on route change
- **WHEN** user navigates to `/products/42`
- **THEN** `ActiveViewContext.getActiveView()` reflects the current route

### Requirement: Foreground re-emit
The provider SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` on mount. The re-emitter SHALL reset the provider's `previousScreenNameRef.current` to `null`, then read the latest stashed pathname, then start a new screen-lifetime span using the same code path as initial emission.

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

### Requirement: Cleanup on unmount
The provider SHALL end the current screen-lifetime span, clear the active view context, and call the unregister function returned by `ActiveViewContext.registerForegroundReEmitter(...)` on unmount.

#### Scenario: Provider unmounts
- **WHEN** `<EdotExpoNavigationProvider>` unmounts
- **THEN** the current view span ends and active view context is cleared
- **AND** the foreground re-emitter SHALL be unregistered from `ActiveViewContext`
