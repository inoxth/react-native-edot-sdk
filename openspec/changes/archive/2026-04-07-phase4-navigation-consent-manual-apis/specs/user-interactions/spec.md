## ADDED Requirements

### Requirement: withEdotTracking HOC
The SDK SHALL export `withEdotTracking(Component, actionName?)` that wraps a React component and automatically calls `EdotReactNative.addAction('tap', actionName || componentDisplayName)` when the wrapped component's `onPress` fires. Additional attributes SHALL include `view.name` from ActiveViewContext.

#### Scenario: Auto-tracked tap
- **WHEN** a component wrapped with `withEdotTracking(AddToCartButton)` receives an `onPress` event
- **THEN** `EdotReactNative.addAction('tap', 'AddToCartButton')` is called
- **AND** the original `onPress` handler still fires

#### Scenario: Custom action name
- **WHEN** `withEdotTracking(Button, 'checkout.confirm')` wraps a button
- **AND** the button is pressed
- **THEN** `EdotReactNative.addAction('tap', 'checkout.confirm')` is called

#### Scenario: View context included
- **WHEN** the active view is `CartScreen` and a tracked button is pressed
- **THEN** the action includes attribute `view.name: CartScreen`

### Requirement: useEdotAction hook
The SDK SHALL export `useEdotAction()` hook that returns a `trackAction(type, name, attributes?)` function. The hook SHALL automatically attach `view.name` from ActiveViewContext to the attributes.

#### Scenario: Manual action tracking
- **WHEN** `const { trackAction } = useEdotAction()` is called in a component
- **AND** `trackAction('swipe', 'dismiss_card', { 'card.id': '42' })` is invoked
- **THEN** `EdotReactNative.addAction('swipe', 'dismiss_card', { 'card.id': '42', 'view.name': currentViewName })` is called

#### Scenario: No active view
- **WHEN** no navigation plugin is configured (ActiveViewContext is null)
- **AND** `trackAction('tap', 'login')` is called
- **THEN** the action is recorded without `view.name` attribute
