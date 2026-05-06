## MODIFIED Requirements

### Requirement: Expo Router integration example
The example at `example/expo-router/` SHALL demonstrate `@inox/react-native-edot-navigation` integration (via the `<EdotNavigationProvider>` component) with `expo-router` using both bottom tab layout and stack navigation, with the provider receiving the ref returned by `useNavigationContainerRef()` from `expo-router`.

#### Scenario: Screen-lifetime spans created on tab switch
- **WHEN** the user switches between bottom tabs (Home, Demos, Settings)
- **THEN** screen-lifetime spans are created via `<EdotNavigationProvider>` with `screen.name` set to the active route segment name (e.g. `index`, `network`, `(tabs)`)
- **AND** the previous screen-lifetime span ends with status OK
- **AND** `last.screen.name` is set to the previous route segment on the new span

#### Scenario: Screen-lifetime spans created on stack push
- **WHEN** the user navigates to a detail route from a tab
- **THEN** a screen-lifetime span is created with `screen.name` set to the detail route segment and `last.screen.name` set to the source tab
- **AND** `instrumentation.scope.name` SHALL be `@inox/react-native-edot-navigation`

#### Scenario: Screen name mapper applied
- **WHEN** a `screenNameMapper` is configured on `<EdotNavigationProvider>`
- **THEN** route segment names are transformed before span creation
