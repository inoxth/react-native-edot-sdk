# error-tracking

## Purpose

TBD

## Requirements

### Requirement: View correlation on error spans
The JS error handler SHALL attach `screen.name` and `screen.id` from `ActiveViewContext` as attributes on error spans when an active view is available. The attribute keys `view.name` and `view.id` SHALL NOT be present on any error span emitted by the SDK.

#### Scenario: JS error during active screen
- **WHEN** the active view is `"CheckoutScreen"` with span ID `"abc123"`
- **AND** an uncaught JS exception occurs
- **THEN** the error span SHALL include `screen.name = "CheckoutScreen"`
- **AND** the error span SHALL include `screen.id = "abc123"`
- **AND** the error span SHALL NOT include `view.name` or `view.id`

#### Scenario: JS error with no active screen
- **WHEN** no navigation plugin is configured
- **AND** an uncaught JS exception occurs
- **THEN** the error span SHALL NOT include `screen.name` or `screen.id`

### Requirement: Per-instrumentation tracer scope on error spans
Error spans SHALL be started with `instrumentationName = "@inoxth/react-native-edot-sdk/errors"`.

#### Scenario: Error span scope
- **WHEN** an uncaught JS exception is reported
- **THEN** the error span SHALL be started with `instrumentationName = "@inoxth/react-native-edot-sdk/errors"`
