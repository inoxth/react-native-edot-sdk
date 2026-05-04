## MODIFIED Requirements

### Requirement: withEdotTracking HOC
The SDK SHALL export `withEdotTracking(Component, actionName?)` that wraps a React component and automatically calls `EdotReactNative.addAction('tap', actionName || componentDisplayName)` when the wrapped component's `onPress` fires. Additional attributes SHALL include `screen.name` from `ActiveViewContext` when available. The attribute key `view.name` SHALL NOT be set on actions emitted by the HOC.

#### Scenario: Auto-tracked tap
- **WHEN** a component wrapped with `withEdotTracking(AddToCartButton)` receives an `onPress` event
- **THEN** `EdotReactNative.addAction('tap', 'AddToCartButton')` SHALL be called
- **AND** the original `onPress` handler SHALL still fire

#### Scenario: Custom action name
- **WHEN** `withEdotTracking(Button, 'checkout.confirm')` wraps a button
- **AND** the button is pressed
- **THEN** `EdotReactNative.addAction('tap', 'checkout.confirm')` SHALL be called

#### Scenario: View context included
- **WHEN** the active view is `"CartScreen"` and a tracked button is pressed
- **THEN** the action SHALL include attribute `screen.name = "CartScreen"`
- **AND** the action SHALL NOT include attribute `view.name`

### Requirement: useEdotAction hook
The SDK SHALL export `useEdotAction()` hook that returns a `trackAction(type, name, attributes?)` function. The hook SHALL automatically attach `screen.name` from `ActiveViewContext` to the attributes when an active view exists. The attribute key `view.name` SHALL NOT be set.

#### Scenario: Manual action tracking
- **WHEN** `const { trackAction } = useEdotAction()` is called in a component
- **AND** `trackAction('swipe', 'dismiss_card', { 'card.id': '42' })` is invoked while the active view is `"CartScreen"`
- **THEN** `EdotReactNative.addAction('swipe', 'dismiss_card', { 'card.id': '42', 'screen.name': 'CartScreen' })` SHALL be called

#### Scenario: No active view
- **WHEN** no navigation plugin is configured (`ActiveViewContext.getActiveView()` returns `null`)
- **AND** `trackAction('tap', 'login')` is called
- **THEN** the action SHALL be recorded without `screen.name`
- **AND** the action SHALL NOT include `view.name`
