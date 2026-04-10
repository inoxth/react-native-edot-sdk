## ADDED Requirements

### Requirement: Expo Router integration example
The example at `example/expo-router/` SHALL demonstrate `@inox/react-native-edot-expo-router` integration with `expo-router` using both bottom tab layout and stack navigation.

#### Scenario: View spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** view spans are created via `<EdotExpoNavigationProvider>` with `view.name` and `view.url` attributes

#### Scenario: View spans created on stack push
- **WHEN** the user navigates to a detail route from a tab
- **THEN** a view span is created with the detail pathname and `view.previous` set to the source tab

#### Scenario: Pathname mapper applied
- **WHEN** a `screenNameMapper` is configured on the provider
- **THEN** pathnames are transformed before span creation (e.g., `/products/42` → `/products/:id`)

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
