## ADDED Requirements

### Requirement: React Navigation integration example
The example at `example/react-navigation/` SHALL demonstrate `@inoxth/react-native-edot-navigation` integration with `@react-navigation/native` using both bottom tab navigation and stack navigation, via the `<EdotNavigationProvider navigationRef={...}>` component pattern wrapping a `NavigationContainer` whose ref comes from `useNavigationContainerRef()`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `<EdotNavigationProvider>` with `screen.name` set to the active route name
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous route name on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user navigates from a tab screen to a detail screen via stack navigation
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail screen and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inoxth/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured on `<EdotNavigationProvider>`
- **THEN** route names are transformed before span creation (e.g., stripping IDs)

### Requirement: React Navigation example uses bottom tabs with nested stacks
The example SHALL use `@react-navigation/bottom-tabs` for the main navigation with stack navigators nested inside each tab.

#### Scenario: Bottom tab layout
- **WHEN** the app launches
- **THEN** a bottom tab bar is visible with at least 3 tabs (Home, Demos, Settings)
- **THEN** each tab contains a stack navigator allowing push navigation to detail screens

### Requirement: React Navigation example uses .env config
The example SHALL use `.env` for SDK configuration, following the same pattern as the basic example.

#### Scenario: SDK initializes from .env
- **WHEN** the developer copies `.env.example` to `.env` and fills in values
- **THEN** the SDK initializes with the configured server URL and service identity

### Requirement: React Navigation example includes basic features
The example SHALL demonstrate manual tracing, metrics, logs, and user/session APIs on dedicated screens accessible via navigation.

#### Scenario: Full feature set available
- **WHEN** the example app is running
- **THEN** the user can access tracing, metrics, logs, user, and session demos via tab navigation and stack screens
