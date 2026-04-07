## MODIFIED Requirements

### Requirement: XHR monkey-patching creates spans
The SDK SHALL patch `XMLHttpRequest.prototype.open` and `XMLHttpRequest.prototype.send` to create OTel spans for XHR-based requests. The span SHALL include attributes: `http.method`, `http.url` (sanitized), `http.status_code`, `http.request_content_length`, `http.response_content_length`. When an active view context exists at the time `send` is called, the span SHALL also include `view.name` and `view.id` attributes. The span status SHALL be ERROR for status codes >= 400. When an active view context exists, the SDK SHALL call `addSpanLink` to create an OTel span link from the network span to the active view span.

#### Scenario: XHR request creates span with attributes
- **WHEN** an XHR GET request to `'https://api.example.com/users'` is made
- **THEN** a span named `HTTP GET` is created with `http.url` set to the sanitized URL
- **THEN** `http.status_code` is set when the response arrives
- **THEN** the span ends after the load event

#### Scenario: XHR span includes view correlation when active view exists
- **WHEN** the active view is `'HomeScreen'` with spanId `'hs1'` and traceId `'ht1'`
- **WHEN** an XHR request to `'https://api.example.com/feed'` is made
- **THEN** the span includes attribute `view.name: 'HomeScreen'`
- **THEN** the span includes attribute `view.id: 'hs1'`
- **THEN** `addSpanLink` is called with the XHR spanId and the view's traceId/spanId

#### Scenario: XHR span has no view attributes when no active view
- **WHEN** no active view has been set
- **WHEN** an XHR request to `'https://api.example.com/data'` is made
- **THEN** the span does NOT include `view.name` or `view.id` attributes
- **THEN** `addSpanLink` is NOT called

#### Scenario: View context captured at send time not completion time
- **WHEN** the active view is `'ScreenA'` with spanId `'a1'`
- **WHEN** `xhr.send()` is called
- **WHEN** the active view changes to `'ScreenB'` before the response arrives
- **THEN** the XHR span's `view.name` is `'ScreenA'`
- **THEN** the XHR span's `view.id` is `'a1'`
