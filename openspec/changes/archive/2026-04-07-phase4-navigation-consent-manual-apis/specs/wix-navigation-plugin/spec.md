## ADDED Requirements

### Requirement: Wix Navigation listener registration
The SDK SHALL provide `registerEdotNavigationListener(Navigation)` that accepts the Wix `Navigation` singleton. It SHALL register a `ComponentDidAppear` event listener to detect screen transitions. It SHALL return a cleanup function that removes the listener.

#### Scenario: Listener registration
- **WHEN** `registerEdotNavigationListener(Navigation)` is called
- **THEN** it registers a `ComponentDidAppear` listener on the `Navigation` object
- **AND** returns a function that removes the listener when called

### Requirement: View span creation on ComponentDidAppear
The plugin SHALL create a view span on each `ComponentDidAppear` event. It SHALL end the previous view span, create a new span `Navigation: {componentName}` with attributes `view.name`, `view.previous`, `view.transition_type`. The plugin SHALL accept an optional `screenNameMapper` in the options parameter.

#### Scenario: Component appears creates span
- **WHEN** `ComponentDidAppear` fires with `componentName: 'CartScreen'`
- **AND** previous screen was `HomeScreen`
- **THEN** the `HomeScreen` view span ends
- **AND** a new span `Navigation: CartScreen` is created with `view.previous: HomeScreen`

#### Scenario: Screen name mapper
- **WHEN** options include `screenNameMapper: (name) => name.replace('Screen', '')`
- **AND** `ComponentDidAppear` fires with `componentName: 'CartScreen'`
- **THEN** the span name is `Navigation: Cart` and `view.name` is `Cart`

### Requirement: ActiveViewContext integration
The plugin SHALL call `ActiveViewContext.setActiveView()` on each `ComponentDidAppear` event.

#### Scenario: Active view updated
- **WHEN** `ComponentDidAppear` fires with `componentName: 'CartScreen'`
- **THEN** `ActiveViewContext.getActiveView()` reflects `CartScreen`

### Requirement: Cleanup function
The returned cleanup function SHALL remove the event listener and end the current view span.

#### Scenario: Cleanup
- **WHEN** the cleanup function returned by `registerEdotNavigationListener` is called
- **THEN** the `ComponentDidAppear` listener is removed
- **AND** the current view span ends
