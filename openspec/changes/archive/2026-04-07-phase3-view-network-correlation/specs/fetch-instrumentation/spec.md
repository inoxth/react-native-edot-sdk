## MODIFIED Requirements

### Requirement: Fetch monkey-patching creates spans
The SDK SHALL replace `global.fetch` with a wrapper that creates an OTel span for each outgoing HTTP request. The span SHALL include attributes: `http.method`, `http.url` (sanitized), `http.status_code`, `http.request_content_length`, `http.response_content_length`. When an active view context exists, the span SHALL also include `view.name` and `view.id` attributes. The span status SHALL be ERROR for status codes >= 400. The original `global.fetch` SHALL be preserved and called for the actual request. When an active view context exists, the SDK SHALL call `addSpanLink` to create an OTel span link from the network span to the active view span.

#### Scenario: Successful fetch creates span with attributes
- **WHEN** `fetch('https://api.example.com/users')` is called
- **THEN** a span named `HTTP GET` is created
- **THEN** `http.url` is set to the sanitized URL
- **THEN** `http.status_code` is set when the response arrives
- **THEN** the span ends after the response is received

#### Scenario: Failed fetch records exception
- **WHEN** `fetch('https://unreachable.example.com')` throws a network error
- **THEN** the span records the exception
- **THEN** the span status is set to ERROR
- **THEN** the original error is re-thrown to the caller

#### Scenario: Fetch span includes view correlation when active view exists
- **WHEN** the active view is `'ProductDetailScreen'` with spanId `'vs1'` and traceId `'vt1'`
- **WHEN** `fetch('https://api.example.com/products/1')` is called
- **THEN** the span includes attribute `view.name: 'ProductDetailScreen'`
- **THEN** the span includes attribute `view.id: 'vs1'`
- **THEN** `addSpanLink` is called with the network spanId and the view's traceId/spanId

#### Scenario: Fetch span has no view attributes when no active view
- **WHEN** no active view has been set
- **WHEN** `fetch('https://api.example.com/data')` is called
- **THEN** the span does NOT include `view.name` or `view.id` attributes
- **THEN** `addSpanLink` is NOT called

#### Scenario: In-flight fetch during navigation links to originating screen
- **WHEN** the active view is `'ScreenA'` with spanId `'a1'`
- **WHEN** `fetch('https://api.example.com/slow')` is called
- **WHEN** the active view changes to `'ScreenB'` before the response arrives
- **THEN** the fetch span's `view.name` is `'ScreenA'` (captured at request start)
- **THEN** the fetch span's `view.id` is `'a1'` (captured at request start)
