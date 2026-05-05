## MODIFIED Requirements

### Requirement: Expo Router navigation provider
The SDK SHALL provide `<EdotExpoNavigationProvider>` React component that wraps the app's root layout. It SHALL accept a required `navigationRef` prop obtained from `expo-router`'s `useNavigationContainerRef()` hook. It SHALL accept an optional `screenNameMapper` prop with signature `(routeName: string, params?: object) => string`. It SHALL subscribe to `state` events on the `navigationRef` to detect route changes.

#### Scenario: Provider wraps app
- **WHEN** `<EdotExpoNavigationProvider navigationRef={navigationRef}>` wraps the `<Stack>` element
- **THEN** it subscribes to `state` events on `navigationRef`
- **AND** it reads the active route via `navigationRef.getCurrentRoute()`

### Requirement: View span creation on route change
The provider SHALL create a screen-lifetime span on each route change. It SHALL end the previous span and create a new one with span name equal to the route name (after any `screenNameMapper` transformation), with attributes `screen.name` and (when applicable) `last.screen.name`. The span SHALL be started with `instrumentationName = "@inox/react-native-edot-expo-router"`.

#### Scenario: Route change creates span
- **WHEN** user navigates from `index` to `network` via expo-router
- **THEN** the `index` screen-lifetime span SHALL end
- **AND** a new span named `"network"` SHALL be created
- **AND** the span SHALL have `screen.name = "network"`
- **AND** the span SHALL have `last.screen.name = "index"`
- **AND** the span SHALL be started with `instrumentationName = "@inox/react-native-edot-expo-router"`

#### Scenario: Initial route creates first span
- **WHEN** `<EdotExpoNavigationProvider>` mounts and `navigationRef.getCurrentRoute()` returns `{ name: 'index' }`
- **THEN** a span named `"index"` SHALL be created
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Initial route arrives after mount
- **GIVEN** `<EdotExpoNavigationProvider>` mounts before the navigation container is ready
- **AND** `navigationRef.getCurrentRoute()` returns `undefined` at mount time
- **WHEN** the navigation container subsequently emits a `state` event with route `{ name: 'index' }`
- **THEN** a span named `"index"` SHALL be created

#### Scenario: Screen name mapper applied
- **WHEN** `screenNameMapper` is `(name, params) => params?.id !== undefined ? \`${name}/:id\` : name`
- **AND** user navigates to a route `{ name: 'UserProfile', params: { id: 42 } }`
- **THEN** the span name SHALL be `"UserProfile/:id"`
- **AND** `screen.name` SHALL be `"UserProfile/:id"`

#### Scenario: Repeated state event with same screen name does not re-emit
- **GIVEN** the active screen-lifetime span is for route `index`
- **WHEN** a `state` event fires and `getCurrentRoute()` still returns `{ name: 'index' }`
- **THEN** no new span SHALL be created
- **AND** the existing span SHALL remain active

### Requirement: ActiveViewContext integration
The provider SHALL call `ActiveViewContext.setActiveView()` on each route change with the post-mapped screen name and the new span ID.

#### Scenario: Active view updated on route change
- **WHEN** user navigates to route `network`
- **THEN** `ActiveViewContext.getActiveView()` reflects `{ name: 'network', spanId: <new span id> }`

### Requirement: Foreground re-emit
The provider SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` (through the shared `createNavigationLifecycle` helper). The re-emitter SHALL read the current screen via `navigationRef.getCurrentRoute()`, then start a new screen-lifetime span using the same code path as initial emission. `last.screen.name` SHALL NOT be set on the re-emitted span.

#### Scenario: Foreground replays current route
- **GIVEN** `navigationRef.getCurrentRoute()` returns `{ name: 'index' }`
- **AND** the SDK's AppState handler invokes registered foreground re-emitters
- **WHEN** the expo-router provider's re-emitter runs
- **THEN** a new span named `"index"` SHALL be created
- **AND** the span SHALL have `screen.name = "index"`
- **AND** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground with no current route
- **GIVEN** `navigationRef.getCurrentRoute()` returns `undefined`
- **WHEN** the re-emitter runs
- **THEN** no span SHALL be created

### Requirement: Cleanup on unmount
The provider SHALL end the current screen-lifetime span, clear the active view context, unsubscribe from `state` events on the `navigationRef`, and unregister the foreground re-emitter on unmount.

#### Scenario: Provider unmounts
- **WHEN** `<EdotExpoNavigationProvider>` unmounts
- **THEN** the current view span SHALL end
- **AND** active view context SHALL be cleared
- **AND** the `state` listener SHALL be removed from `navigationRef`
- **AND** the foreground re-emitter SHALL be unregistered from `ActiveViewContext`

## REMOVED Requirements

### Requirement: usePathname-based route detection
**Reason:** Replaced by `useNavigationContainerRef()`-based detection. URL pathnames as span names interact poorly with Elastic APM Server's transaction grouping (some paths are silently dropped on ingestion). Route segment names produced by `getCurrentRoute().name` are identifier-style (`index`, `network`, `(tabs)`) and align with the `react-native-navigation` plugin, which already emits identifier-style names successfully.

**Migration:** Consumers must update their root `_layout.tsx` to obtain `useNavigationContainerRef()` from `expo-router` and pass the ref as the `navigationRef` prop. The `screenNameMapper` signature changes from `(pathname: string) => string` to `(routeName: string, params?: object) => string`. No backwards-compatibility shim is provided.
