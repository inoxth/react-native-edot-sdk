## MODIFIED Requirements

### Requirement: Error spans include view correlation
The error handler SHALL attach the active screen name to every JS error span as a `screen.name` attribute when `ActiveViewContext.getActiveView()` returns a non-null value. When an active view exists, the error span SHALL also include a `screen.id` attribute with the active view's `spanId`. The attribute keys `view.name` and `view.id` SHALL NOT be present on any error span emitted by the SDK.

#### Scenario: Error on a screen includes screen attributes
- **WHEN** the active view is set to `"CheckoutScreen"` with span ID `"abc123"`
- **WHEN** an uncaught JS error occurs
- **THEN** the error span SHALL include attribute `screen.name = "CheckoutScreen"`
- **AND** the error span SHALL include attribute `screen.id = "abc123"`
- **AND** the error span SHALL NOT include `view.name` or `view.id`

#### Scenario: Error with no active view
- **WHEN** no active view has been set
- **WHEN** an uncaught JS error occurs
- **THEN** the error span SHALL NOT include `screen.name` or `screen.id`
