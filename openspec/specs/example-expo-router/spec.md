## ADDED Requirements

### Requirement: Expo Router integration example
The example at `example/expo-router/` SHALL demonstrate `@inoxth/react-native-edot-navigation` integration (via the `<EdotNavigationProvider>` component) with `expo-router` using both bottom tab layout and stack navigation, with the provider receiving the ref returned by `useNavigationContainerRef()` from `expo-router`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `<EdotNavigationProvider>` with `screen.name` set to the active route segment name (e.g. `index`, `network`, `(tabs)`)
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous route segment on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user navigates to a detail route from a tab
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail route segment and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inoxth/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured on `<EdotNavigationProvider>`
- **THEN** route segment names are transformed before span creation

### Requirement: Expo Router example uses tab layout with nested routes
The example SHALL use Expo Router's `(tabs)` layout group for bottom tab navigation with nested stack routes inside each tab group.

#### Scenario: Tab layout with routes
- **WHEN** the app launches
- **THEN** a bottom tab bar is visible with at least 3 tabs (Home, Demos, Settings)
- **THEN** each tab group supports nested routes for detail screens

### Requirement: Expo Router example uses .env config
The example SHALL use `.env` for SDK configuration, following the same pattern as the basic example.

#### Scenario: SDK initializes from .env
- **WHEN** the developer copies `.env.example` to `.env` and fills in values
- **THEN** the SDK initializes with the configured server URL and service identity

### Requirement: Expo Router example includes basic features
The example SHALL demonstrate manual tracing, metrics, logs, and user/session APIs on dedicated routes accessible via navigation.

#### Scenario: Full feature set available
- **WHEN** the example app is running
- **THEN** the user can access tracing, metrics, logs, user, and session demos via tab and stack navigation
