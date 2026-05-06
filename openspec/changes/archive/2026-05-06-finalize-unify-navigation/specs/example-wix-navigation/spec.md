## MODIFIED Requirements

### Requirement: Wix react-native-navigation integration example
The example at `example/wix-navigation/` SHALL demonstrate `@inox/react-native-edot-navigation` integration (via the `registerEdotNavigationListener` Wix entry point) with `react-native-navigation` using both bottom tab layout and stack navigation. The listener SHALL be registered inside `Navigation.events().registerAppLaunchedListener` so it is wired before `Navigation.setRoot`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `registerEdotNavigationListener()` with `screen.name` set to the appearing component name (after any `screenNameMapper` transformation)
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous component on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user pushes a detail screen from a tab
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail component and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inox/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured
- **THEN** component names are transformed before span creation
