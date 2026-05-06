## MODIFIED Requirements

### Requirement: React Navigation integration example
The example at `example/react-navigation/` SHALL demonstrate `@inox/react-native-edot-navigation` integration with `@react-navigation/native` using both bottom tab navigation and stack navigation, via the `<EdotNavigationProvider navigationRef={...}>` component pattern wrapping a `NavigationContainer` whose ref comes from `useNavigationContainerRef()`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `<EdotNavigationProvider>` with `screen.name` set to the active route name
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous route name on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user navigates from a tab screen to a detail screen via stack navigation
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail screen and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inox/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured on `<EdotNavigationProvider>`
- **THEN** route names are transformed before span creation (e.g., stripping IDs)
