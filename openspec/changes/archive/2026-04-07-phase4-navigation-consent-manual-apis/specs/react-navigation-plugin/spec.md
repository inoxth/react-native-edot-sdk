## ADDED Requirements

### Requirement: React Navigation container ref factory
The SDK SHALL provide `createEdotNavigationContainerRef()` that returns a `NavigationContainerRef` compatible with `@react-navigation/native` v6+. The ref SHALL be passed to `<NavigationContainer ref={ref}>`. The function SHALL accept an optional `screenNameMapper: (routeName: string, params?: Record<string, unknown>) => string` callback for PII redaction or screen name normalization.

#### Scenario: Container ref creation
- **WHEN** `createEdotNavigationContainerRef()` is called
- **THEN** it returns a valid `NavigationContainerRef` that can be passed to `NavigationContainer`

#### Scenario: Screen name mapper applied
- **WHEN** `createEdotNavigationContainerRef({ screenNameMapper: (name) => name.replace(/\d+/, ':id') })` is used
- **AND** user navigates to `UserProfile/42`
- **THEN** the view span name is `Navigation: UserProfile/:id`

### Requirement: View span creation on navigation state change
The plugin SHALL listen for navigation state changes via `onStateChange` on the container ref. On each state change, it SHALL end the previous view span and start a new one with span name `Navigation: {screenName}` and attributes `view.name`, `view.previous`, `view.transition_type`.

#### Scenario: Screen transition creates span
- **WHEN** user navigates from `HomeScreen` to `ProductDetail`
- **THEN** the `HomeScreen` view span ends with status OK
- **AND** a new span `Navigation: ProductDetail` is created
- **AND** `view.name` is `ProductDetail`
- **AND** `view.previous` is `HomeScreen`
- **AND** `view.transition_type` is `push`

#### Scenario: Initial screen creates first span
- **WHEN** the app starts and the navigation container mounts with initial route `HomeScreen`
- **THEN** a view span `Navigation: HomeScreen` is created with no `view.previous`

### Requirement: ActiveViewContext integration
The plugin SHALL call `ActiveViewContext.setActiveView()` on each screen transition so that network and error spans can correlate to the current screen.

#### Scenario: Active view updated on navigation
- **WHEN** user navigates to `ProductDetail`
- **THEN** `ActiveViewContext.getActiveView()` returns `{ name: 'ProductDetail', spanId: '<spanId>' }`

### Requirement: Cleanup on unmount
The plugin SHALL end the current view span and clear the active view context when the navigation container unmounts.

#### Scenario: Navigation container unmounts
- **WHEN** the `NavigationContainer` unmounts
- **THEN** the current view span ends
- **AND** `ActiveViewContext.getActiveView()` returns `null`
