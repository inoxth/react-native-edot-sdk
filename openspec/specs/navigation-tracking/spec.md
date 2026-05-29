# navigation-tracking

## Purpose

Track screen transitions as OpenTelemetry spans for each supported navigation library, with attribute names aligned to the Elastic mobile spec / opentelemetry-android upstream conventions. All supported navigators ship in a single unified package `@inoxth/react-native-edot-navigation`.

## Requirements

### Requirement: Span shape and attributes
The SDK SHALL create one screen-lifetime span per screen visit. The span SHALL be named with the plain screen name (no `"Navigation: "` prefix) after any `screenNameMapper` transformation. The span kind SHALL be `INTERNAL`. The span SHALL carry attribute `screen.name` set to the current screen identity. The span SHALL carry attribute `last.screen.name` only when a prior screen exists and differs from the new screen (omitted on first emission and on app-foreground re-emit). The SDK SHALL NOT emit the legacy `view.name` / `view.previous` / `view.transition_type` / `view.url` attributes.

#### Scenario: Initial screen span omits last.screen.name
- **WHEN** the very first screen-lifetime span is created (regardless of navigator)
- **THEN** the span SHALL NOT include `last.screen.name`

#### Scenario: Subsequent screen span includes last.screen.name
- **GIVEN** the previous screen-lifetime span was for `Home`
- **WHEN** the user navigates to `Details`
- **THEN** the new span SHALL be named `Details`
- **AND** SHALL include `screen.name = "Details"` and `last.screen.name = "Home"`

### Requirement: Tracer scope
The SDK SHALL pass `instrumentationName = "@inoxth/react-native-edot-navigation"` to `EdotNativeModule.startSpan(...)` for every navigation span so all navigation spans carry the same `instrumentation.scope.name` regardless of which navigator emitted them. The unified package owns one OpenTelemetry scope.

#### Scenario: Component span scope
- **WHEN** `<EdotNavigationProvider>` emits a screen-lifetime span
- **THEN** the span SHALL carry `instrumentation.scope.name = "@inoxth/react-native-edot-navigation"`

#### Scenario: Wix listener span scope
- **WHEN** `registerEdotNavigationListener` emits a screen-lifetime span
- **THEN** the span SHALL carry `instrumentation.scope.name = "@inoxth/react-native-edot-navigation"`

### Requirement: Foreground re-emit
The SDK SHALL register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` so the SDK's app-state listener can re-emit the current screen on foreground. The re-emit SHALL be treated as a fresh visit, with `last.screen.name` omitted.

#### Scenario: Foreground replays current screen as fresh visit
- **GIVEN** the app was on screen `Home` when backgrounded
- **WHEN** the app foregrounds back to `Home`
- **THEN** a new span SHALL be created with `screen.name = "Home"`
- **AND** the new span SHALL NOT include `last.screen.name`

### Requirement: Ref-based navigator support
The SDK SHALL provide an `<EdotNavigationProvider>` React component that accepts a required `navigationRef` prop and an optional `screenNameMapper` prop with signature `(routeName: string, params?: object) => string`. The component SHALL subscribe to `state` events on `navigationRef` via `addListener('state', cb)` and SHALL read the active route via `navigationRef.getCurrentRoute()`. The component SHALL emit the initial route on mount when `getCurrentRoute()` returns a route and SHALL emit on the first `state` event when the container becomes ready after mount. The same component SHALL work for both `@react-navigation/native` and `expo-router` because both expose `useNavigationContainerRef()` returning the same `NavigationContainerRefLike` shape.

#### Scenario: react-navigation screen change
- **GIVEN** the app uses `<EdotNavigationProvider navigationRef={ref}>` with `useNavigationContainerRef()` from `@react-navigation/native`
- **WHEN** the user navigates from `Home` to `ProductDetail`
- **THEN** the `Home` view span SHALL end
- **AND** a new span named `ProductDetail` SHALL be created with `screen.name = "ProductDetail"` and `last.screen.name = "Home"`

#### Scenario: expo-router screen change
- **GIVEN** the app uses `<EdotNavigationProvider navigationRef={ref}>` with `useNavigationContainerRef()` from `expo-router`
- **WHEN** the user navigates from `index` to `network`
- **THEN** the `index` view span SHALL end
- **AND** a new span named `network` SHALL be created with `screen.name = "network"` and `last.screen.name = "index"`

#### Scenario: Initial route arrives after mount
- **GIVEN** `<EdotNavigationProvider>` mounts before the navigation container is ready
- **AND** `navigationRef.getCurrentRoute()` returns `undefined` at mount time
- **WHEN** the navigation container subsequently emits a `state` event with route `{ name: 'index' }`
- **THEN** a span named `index` SHALL be created

#### Scenario: Repeated state event with same screen name does not re-emit
- **GIVEN** the active screen-lifetime span is for `Home`
- **WHEN** a `state` event fires and `getCurrentRoute()` still returns `{ name: 'Home' }`
- **THEN** no new span SHALL be created
- **AND** the existing span SHALL remain active

### Requirement: Wix navigator support
The SDK SHALL provide an imperative `registerEdotNavigationListener(Navigation, options?)` function returning a cleanup function. The function SHALL hook into `Navigation.events().registerComponentDidAppearListener(...)` to detect screen changes and SHALL extract the component name from the event. The function SHALL stash the most recent `ComponentDidAppear` event so the foreground re-emitter can read the current screen. The Wix surface SHALL be exposed as an imperative function (not a React component) because Wix apps have no continuously-mounted React root.

#### Scenario: Wix screen change
- **GIVEN** the app calls `registerEdotNavigationListener(Navigation)` inside `Navigation.events().registerAppLaunchedListener`
- **WHEN** Wix fires `ComponentDidAppear` for `DemosScreen` after `HomeScreen`
- **THEN** the `HomeScreen` view span SHALL end
- **AND** a new span named `DemosScreen` SHALL be created

#### Scenario: Duplicate Wix component event does not re-emit
- **GIVEN** the active screen-lifetime span is for `HomeScreen`
- **WHEN** Wix fires another `ComponentDidAppear` event with `componentName: 'HomeScreen'`
- **THEN** no new span SHALL be created
- **AND** the existing span SHALL remain active

### Requirement: Custom adapter support
The SDK SHALL export `createNavigationLifecycle({ instrumentationName, getCurrentScreenName })` for consumers building support for navigators not shipped out of the box. The function SHALL return an object with `onScreen(name): void` and `cleanup(): void`. Both built-in surfaces (`<EdotNavigationProvider>` and `registerEdotNavigationListener`) SHALL be implemented on top of `createNavigationLifecycle`.

#### Scenario: Custom adapter starts a screen-lifetime span
- **GIVEN** a custom adapter calls `createNavigationLifecycle({ instrumentationName: 'custom', getCurrentScreenName: () => 'X' })`
- **WHEN** the adapter calls `lifecycle.onScreen('X')`
- **THEN** a screen-lifetime span SHALL be created with `screen.name = "X"` and `instrumentation.scope.name = "custom"`

### Requirement: PII redaction via screenNameMapper
The SDK SHALL accept an optional `screenNameMapper` callback that transforms screen names before they are emitted. The component-based surface SHALL pass `(routeName, params?)`. The Wix surface SHALL pass `(componentName)`.

#### Scenario: Mapper redacts dynamic IDs from a route
- **GIVEN** the app uses a `screenNameMapper` that appends `/:id` when params include an `id` field
- **WHEN** the user navigates to a route `{ name: 'UserProfile', params: { id: 42 } }`
- **THEN** the span SHALL be named `UserProfile/:id`
- **AND** `screen.name` SHALL be `"UserProfile/:id"`

### Requirement: Cleanup on unmount or detach
The SDK SHALL end the active screen-lifetime span, clear the active view context, unsubscribe any listeners, and unregister the foreground re-emitter on unmount of the component (ref-based) or invocation of the cleanup function returned by `registerEdotNavigationListener` (Wix).

#### Scenario: Component unmount tears down lifecycle
- **WHEN** `<EdotNavigationProvider>` unmounts
- **THEN** the current view span SHALL end
- **AND** the active view context SHALL be cleared
- **AND** the `state` listener SHALL be removed from `navigationRef`
- **AND** the foreground re-emitter SHALL be unregistered

#### Scenario: Wix listener cleanup tears down lifecycle
- **WHEN** the cleanup function returned by `registerEdotNavigationListener` is invoked
- **THEN** the current view span SHALL end
- **AND** the active view context SHALL be cleared
- **AND** the wix listener SHALL be removed
- **AND** the foreground re-emitter SHALL be unregistered
