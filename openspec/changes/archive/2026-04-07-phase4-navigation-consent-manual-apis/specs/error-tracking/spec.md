## MODIFIED Requirements

### Requirement: View correlation on error spans
The JS error handler SHALL attach `view.name` from ActiveViewContext as an attribute on error spans when an active view is available.

#### Scenario: JS error during active view
- **WHEN** the active view is `CheckoutScreen`
- **AND** an uncaught JS exception occurs
- **THEN** the error span includes `view.name: CheckoutScreen`

#### Scenario: JS error with no active view
- **WHEN** no navigation plugin is configured
- **AND** an uncaught JS exception occurs
- **THEN** the error span does NOT include `view.name`
