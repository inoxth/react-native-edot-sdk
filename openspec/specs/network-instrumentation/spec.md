# network-instrumentation

## Purpose

TBD

## Requirements

### Requirement: View correlation on network spans
The fetch and XHR instrumentation SHALL attach `view.name` and `view.id` (the active view span ID) as attributes on every network span when an active view is available via ActiveViewContext. The network span SHALL also include a span link to the active view span.

#### Scenario: Network request during active view
- **WHEN** the active view is `ProductDetail` with spanId `view-span-123`
- **AND** a fetch request is made to `/api/products/42`
- **THEN** the network span includes `view.name: ProductDetail` and `view.id: view-span-123`

#### Scenario: Network request with no active view
- **WHEN** no navigation plugin is configured (ActiveViewContext returns null)
- **AND** a fetch request is made
- **THEN** the network span does NOT include `view.name` or `view.id` attributes

#### Scenario: View changes during inflight request
- **WHEN** a fetch request starts while active view is `HomeScreen`
- **AND** the user navigates to `ProductDetail` before the response arrives
- **THEN** the network span retains `view.name: HomeScreen` (captured at request start)
