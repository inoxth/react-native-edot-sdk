# Fetch Instrumentation Specification

## Purpose
Monkey-patch `global.fetch` to automatically create OpenTelemetry spans for outgoing HTTP requests with trace propagation, URL sanitization, and GraphQL support.

## Requirements

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

### Requirement: Trace context propagation on fetch
The SDK SHALL inject a W3C `traceparent` header into fetch requests whose URL matches any pattern in `tracePropagationTargets`. The header SHALL NOT be injected for non-matching URLs.

#### Scenario: Traceparent injected for matching URL
- **WHEN** `tracePropagationTargets: [/api\.example\.com/]` is configured
- **WHEN** `fetch('https://api.example.com/users')` is called
- **THEN** the request includes a `traceparent` header in `00-{traceId}-{spanId}-{flags}` format

#### Scenario: Traceparent not injected for non-matching URL
- **WHEN** `tracePropagationTargets: [/api\.example\.com/]` is configured
- **WHEN** `fetch('https://other.example.com/data')` is called
- **THEN** the request does NOT include a `traceparent` header

### Requirement: Deduplication header on fetch
The SDK SHALL add `X-Edot-RN-Traced: 1` header to every JS-patched fetch request to prevent the native EDOT SDK from creating a duplicate span.

#### Scenario: Deduplication header present
- **WHEN** any fetch request is made through the patched `global.fetch`
- **THEN** the request includes `X-Edot-RN-Traced: 1` header

### Requirement: URL sanitization on fetch
The SDK SHALL strip query parameters from URLs by default before recording as span attributes. If `config.urlSanitizer` is provided, it SHALL run after the default sanitizer. Requests to the EDOT server URL SHALL be excluded from instrumentation entirely.

#### Scenario: Query params stripped by default
- **WHEN** `fetch('https://api.example.com/users?token=secret')` is called
- **THEN** `http.url` on the span is `https://api.example.com/users`

#### Scenario: EDOT server URL excluded
- **WHEN** `serverUrl` is `https://apm.example.com:8200`
- **WHEN** `fetch('https://apm.example.com:8200/intake/v2/events')` is called
- **THEN** no span is created for this request

### Requirement: GraphQL operation name extraction on fetch
For POST requests to URLs matching `graphqlUrls`, the SDK SHALL attempt to parse the request body and extract `operationName`. The span name SHALL be `GraphQL: {operationName}` when found.

#### Scenario: GraphQL operation name in span
- **WHEN** `graphqlUrls: [/\/graphql$/]` is configured
- **WHEN** `fetch('https://api.example.com/graphql', { method: 'POST', body: JSON.stringify({ operationName: 'GetUser', query: '...' }) })` is called
- **THEN** the span name is `GraphQL: GetUser`

### Requirement: ignoreUrls filtering on fetch
The SDK SHALL skip instrumentation for fetch requests whose URL matches any pattern in `ignoreUrls`.

#### Scenario: Ignored URL produces no span
- **WHEN** `ignoreUrls: [/\/health$/]` is configured
- **WHEN** `fetch('https://api.example.com/health')` is called
- **THEN** no span is created
- **THEN** the request completes normally
