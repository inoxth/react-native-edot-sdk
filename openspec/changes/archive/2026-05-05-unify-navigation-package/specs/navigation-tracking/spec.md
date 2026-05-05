## MODIFIED Requirements

### General
- MUST create one screen-lifetime span per screen visit, with attributes:
  - `screen.name` — current screen identity (after any `screenNameMapper` transformation)
  - `last.screen.name` — only when a prior screen exists and differs from the new screen (omitted on first emission and on app-foreground re-emit)
- MUST end the previous screen-lifetime span when a new screen appears or when the SDK's app-state handler reports `'background'`
- MUST set the span name to the plain screen name (no `"Navigation: "` prefix)
- MUST set span kind to `INTERNAL` (default)
- MUST pass a per-surface `instrumentationName` to `EdotNativeModule.startSpan(...)` so spans carry distinguishable `instrumentation.scope.name`
- MUST NOT emit the legacy `view.name` / `view.previous` / `view.transition_type` / `view.url` attributes
- SHOULD accept a `screenNameMapper` callback to redact PII from screen names
- MUST be implemented in a single unified package `@inox/react-native-edot-navigation` covering all supported navigators
- MUST register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` so the SDK's app-state listener can re-emit the current screen on foreground (treated as fresh visit; `last.screen.name` omitted)

### Ref-based navigators (`@react-navigation/native` and `expo-router`)
- MUST provide `<EdotNavigationProvider>` React component accepting a required `navigationRef` prop and an optional `screenNameMapper` prop with signature `(routeName: string, params?: object) => string`
- MUST subscribe to `state` events on the `navigationRef` via `addListener('state', cb)` to detect route changes
- MUST read the active route via `navigationRef.getCurrentRoute()`
- MUST emit the initial route on mount when `getCurrentRoute()` returns a route, and on the first `state` event when the container becomes ready after mount
- MUST unsubscribe the `state` listener and call lifecycle cleanup on unmount
- Tracer scope: `"@inox/react-native-edot-navigation"`
- The same component MUST work for both `@react-navigation/native` and `expo-router` because both expose `useNavigationContainerRef()` returning the same `NavigationContainerRefLike` shape

### Wix `react-native-navigation`
- MUST provide `registerEdotNavigationListener(Navigation, options?)` returning a cleanup function
- MUST hook into `Navigation.events().registerComponentDidAppearListener(...)` to detect screen changes
- MUST extract the component name from the event
- MUST stash the most recent `ComponentDidAppearEvent` so the lifecycle's foreground re-emitter can read the current screen
- MUST be exposed as an imperative function (not a React component) because Wix apps have no continuously-mounted React root
- Tracer scope: `"@inox/react-native-edot-wix-navigation"`

### Custom adapters
- The package MUST export `createNavigationLifecycle({ instrumentationName, getCurrentScreenName })` for consumers building support for navigators not shipped out of the box
- Both built-in surfaces (`<EdotNavigationProvider>` and `registerEdotNavigationListener`) MUST be implemented on top of `createNavigationLifecycle`

### Scenarios

#### Scenario: react-navigation screen change via the unified component
- **Given** the app uses `<EdotNavigationProvider navigationRef={navigationRef}>` with `useNavigationContainerRef()` from `@react-navigation/native`
- **When** user navigates from `Home` to `ProductDetail`
- **Then** the `Home` view span ends with status OK
- **And** a new span named `ProductDetail` is created (no `"Navigation: "` prefix)
- **And** `screen.name` is set to `ProductDetail`
- **And** `last.screen.name` is set to `Home`
- **And** the span carries `instrumentation.scope.name = "@inox/react-native-edot-navigation"`

#### Scenario: expo-router screen change via the unified component
- **Given** the app uses `<EdotNavigationProvider navigationRef={navigationRef}>` with `useNavigationContainerRef()` from `expo-router`
- **When** user navigates from `index` to `network`
- **Then** the `index` view span ends with status OK
- **And** a new span named `network` is created
- **And** `screen.name = "network"` and `last.screen.name = "index"`
- **And** the span carries `instrumentation.scope.name = "@inox/react-native-edot-navigation"`

#### Scenario: Wix screen change via the imperative listener
- **Given** the app calls `registerEdotNavigationListener(Navigation)` inside `Navigation.events().registerAppLaunchedListener`
- **When** Wix fires `ComponentDidAppear` for `DemosScreen` after `HomeScreen`
- **Then** the `HomeScreen` view span ends
- **And** a new span named `DemosScreen` is created
- **And** the span carries `instrumentation.scope.name = "@inox/react-native-edot-wix-navigation"`

#### Scenario: Initial screen omits last.screen.name
- **When** the very first screen-lifetime span is created (regardless of navigator)
- **Then** the span SHALL NOT include `last.screen.name`

#### Scenario: Foreground re-emit treats screen as fresh visit
- **Given** the app was on screen `Home` when backgrounded
- **When** the app foregrounds back to `Home`
- **Then** a new span SHALL be created with `screen.name = "Home"`
- **And** the new span SHALL NOT include `last.screen.name`

#### Scenario: Initial route arrives after mount (ref-based)
- **Given** `<EdotNavigationProvider>` mounts before the navigation container is ready
- **And** `navigationRef.getCurrentRoute()` returns `undefined` at mount time
- **When** the navigation container subsequently emits a `state` event with route `{ name: 'index' }`
- **Then** a span named `index` SHALL be created

#### Scenario: Repeated screen event does not re-emit
- **Given** the active screen-lifetime span is for `Home`
- **When** the navigator reports `Home` again (state event with same route, or a duplicate `ComponentDidAppear`)
- **Then** no new span SHALL be created
- **And** the existing span SHALL remain active

## REMOVED Requirements

### Requirement: Per-navigator separate packages
**Reason:** All three navigator surfaces now share `createNavigationLifecycle`; separate packaging adds three `package.json`, three builds, three publishes, three install commands with no offsetting benefit. Pre-publish (`private: true`, `0.0.0`) consolidation is a clean cutover.

**Migration:** Consumers update one import path. `@inox/react-native-edot-expo-router` → `@inox/react-native-edot-navigation`. `@inox/react-native-edot-wix-navigation` → `@inox/react-native-edot-navigation`. Plain react-navigation consumers also migrate from `createEdotNavigationContainerRef()` to `<EdotNavigationProvider>` — see updated `example/react-navigation/src/App.tsx`.

### Requirement: `createEdotNavigationContainerRef()` imperative API
**Reason:** Replaced by `<EdotNavigationProvider>` for consistency with expo-router. Both ref-based navigators now use the same component pattern. The component is built on `useNavigationContainerRef()` (provided by `@react-navigation/native` and re-exported by `expo-router`), which is the modern recommended way to obtain the container ref.

**Migration:**
```tsx
// Before
const edotNav = useRef(createEdotNavigationContainerRef({ screenNameMapper }));
return (
  <NavigationContainer
    ref={edotNav.current.navigationRef}
    onReady={edotNav.current.onReady}
    onStateChange={edotNav.current.onStateChange}
  >
    ...
  </NavigationContainer>
);

// After
const navigationRef = useNavigationContainerRef();
return (
  <EdotNavigationProvider navigationRef={navigationRef} screenNameMapper={screenNameMapper}>
    <NavigationContainer ref={navigationRef}>
      ...
    </NavigationContainer>
  </EdotNavigationProvider>
);
```

### Requirement: `EdotExpoNavigationProvider` export name
**Reason:** Renamed to `EdotNavigationProvider` since the same component now serves react-navigation as well. Same component, same prop shape, same usage — just a new name.

**Migration:** Find/replace `EdotExpoNavigationProvider` → `EdotNavigationProvider` and update the import path.
