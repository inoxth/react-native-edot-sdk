## ADDED Requirements

### Requirement: Wix react-native-navigation integration example
The example at `example/wix-navigation/` SHALL demonstrate `@inoxth/react-native-edot-navigation` integration (via the `registerEdotNavigationListener` Wix entry point) with `react-native-navigation` using both bottom tab layout and stack navigation. The listener SHALL be registered inside `Navigation.events().registerAppLaunchedListener` so it is wired before `Navigation.setRoot`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `registerEdotNavigationListener()` with `screen.name` set to the appearing component name (after any `screenNameMapper` transformation)
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous component on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user pushes a detail screen from a tab
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail component and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inoxth/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured
- **THEN** component names are transformed before span creation

### Requirement: Wix Navigation example uses bottom tabs with stack push
The example SHALL use `Navigation.setRoot` with `bottomTabs` layout containing stacks, and `Navigation.push` for detail screens.

#### Scenario: Bottom tab layout
- **WHEN** the app launches
- **THEN** a bottom tab bar is visible with at least 3 tabs (Home, Demos, Settings)
- **THEN** each tab supports pushing detail screens via `Navigation.push`

### Requirement: Wix Navigation example uses .env config
The example SHALL use `.env` for SDK configuration, following the same pattern as the basic example.

#### Scenario: SDK initializes from .env
- **WHEN** the developer copies `.env.example` to `.env` and fills in values
- **THEN** the SDK initializes with the configured server URL and service identity

### Requirement: Wix Navigation example includes basic features
The example SHALL demonstrate manual tracing, metrics, logs, and user/session APIs on dedicated screens accessible via navigation.

#### Scenario: Full feature set available
- **WHEN** the example app is running
- **THEN** the user can access tracing, metrics, logs, user, and session demos via tab navigation and stack screens
