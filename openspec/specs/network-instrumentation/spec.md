# network-instrumentation

## Purpose

TBD

## Requirements

### Requirement: View correlation on network spans
The fetch and XHR instrumentation SHALL attach `screen.name` and `screen.id` (the active screen-lifetime span's ID) as attributes on every network span when `ActiveViewContext.getActiveView()` returns a non-null value at the time the network span is created. The network span SHALL also include a span link to the active screen-lifetime span.

The attribute keys `view.name` and `view.id` SHALL NOT be present on any network span emitted by the SDK.

#### Scenario: Network request during active screen
- **WHEN** the active view is `"ProductDetail"` with span ID `"view-span-123"`
- **AND** a fetch request is made to `/api/products/42`
- **THEN** the network span SHALL include `screen.name = "ProductDetail"`
- **AND** the network span SHALL include `screen.id = "view-span-123"`
- **AND** the network span SHALL NOT include `view.name` or `view.id`

#### Scenario: Network request with no active screen
- **WHEN** no navigation plugin is configured (`ActiveViewContext.getActiveView()` returns `null`)
- **AND** a fetch request is made
- **THEN** the network span SHALL NOT include `screen.name` or `screen.id`

#### Scenario: View changes during inflight request
- **WHEN** a fetch request starts while the active view is `"HomeScreen"` (span ID `"home-1"`)
- **AND** the user navigates to `"ProductDetail"` before the response arrives
- **THEN** the network span SHALL retain `screen.name = "HomeScreen"` (captured at request start)
- **AND** the network span SHALL retain `screen.id = "home-1"`

### Requirement: Per-instrumentation tracer scope on network spans
Network spans SHALL be started with `instrumentationName = "@inoxth/react-native-edot-sdk/fetch"` (for `fetch`) or `"@inoxth/react-native-edot-sdk/xhr"` (for `XHR`).

#### Scenario: Fetch scope
- **WHEN** any `fetch(...)` call is made
- **THEN** the resulting network span SHALL be started with `instrumentationName = "@inoxth/react-native-edot-sdk/fetch"`

#### Scenario: XHR scope
- **WHEN** any `XMLHttpRequest` is sent
- **THEN** the resulting network span SHALL be started with `instrumentationName = "@inoxth/react-native-edot-sdk/xhr"`
