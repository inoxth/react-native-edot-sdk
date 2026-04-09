## ADDED Requirements

### Requirement: React Navigation integration example
The example at `example/react-navigation/` SHALL demonstrate `@inox/react-native-edot-navigation` integration with `@react-navigation/native` using both bottom tab navigation and stack navigation.

#### Scenario: View spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** view spans are created via `createEdotNavigationContainerRef()` with `view.name` and `view.transition_type` attributes

#### Scenario: View spans created on stack push
- **WHEN** the user navigates from a tab screen to a detail screen via stack navigation
- **THEN** a view span is created with `view.name` set to the detail screen and `view.previous` set to the source tab

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured
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
