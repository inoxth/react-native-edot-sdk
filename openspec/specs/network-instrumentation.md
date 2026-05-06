# Network Instrumentation Specification

## Purpose
Automatically capture HTTP network requests initiated from the JavaScript thread
as OpenTelemetry spans with W3C trace context propagation.

## Requirements

### Auto-Instrumentation
- MUST monkey-patch `global.fetch` to create spans for all outgoing HTTP requests
- MUST accept any input type that the spec form of `fetch(input, init?)` accepts — including `string`, `Request`, and `URL`. When a `URL` instance is provided, the wrapper SHALL convert it to its string form for URL extraction, span attribute population, and forwarding to the original `fetch`.
- MUST monkey-patch `XMLHttpRequest` to create spans for all XHR-based requests (including Axios)
- MUST set span attributes following OpenTelemetry HTTP Semantic Conventions: `http.method`, `http.url`, `http.status_code`, `http.request_content_length`, `http.response_content_length`
- MUST set span status to ERROR for HTTP status codes >= 400
- MUST record exceptions on network failures (timeout, DNS error, etc.)
- MUST support `ignoreUrls` config to exclude matching URLs from instrumentation
- MUST NOT intercept requests to the EDOT server endpoint itself (prevent infinite loop)
- SHOULD strip query parameters from `http.url` attribute by default (PII protection)
- MAY accept a `urlSanitizer` callback for custom URL scrubbing

### Trace Context Propagation
- MUST inject W3C `traceparent` header into requests matching `tracePropagationTargets`
- MUST NOT inject headers into requests that do NOT match `tracePropagationTargets`
- MUST support both string and RegExp patterns in `tracePropagationTargets`

### Deduplication
- MUST set `X-Edot-RN-Traced: 1` header on JS-patched requests
- The native module MUST check for this header and skip creating a duplicate span

### GraphQL
- SHOULD extract `operationName` from request body for URLs matching `graphqlUrls`
- SHOULD use span name `GraphQL: {operationName}` when operation name is found

### Scenarios

#### Scenario: Fetch request creates span
- **Given** the SDK is initialized with `instrumentNetworkRequests: true`
- **When** `fetch('https://api.example.com/users')` is called
- **Then** a span named `HTTP GET` is created with `http.url: https://api.example.com/users`
- **And** the span ends when the response is received
- **And** `http.status_code` is set to the response status

#### Scenario: Axios request intercepted via XHR
- **Given** the SDK is initialized
- **When** `axios.get('https://api.example.com/users')` is called
- **Then** a span is created because Axios uses XMLHttpRequest internally
- **And** the span attributes match the same schema as fetch requests

#### Scenario: URL in ignoreUrls is skipped
- **Given** `ignoreUrls: [/\/health$/]` is configured
- **When** `fetch('https://api.example.com/health')` is called
- **Then** no span is created for this request

#### Scenario: Trace context propagation
- **Given** `tracePropagationTargets: [/api\.example\.com/]` is configured
- **When** `fetch('https://api.example.com/users')` is called
- **Then** the request includes a `traceparent` header in W3C format

### Requirement: Network instrumentation wired into initialize
The SDK SHALL automatically set up fetch and XHR instrumentation when `EdotReactNative.initialize()` is called with `instrumentNetworkRequests: true` (the default). Instrumentation SHALL be teardown-able via an internal cleanup mechanism.

#### Scenario: Network instrumentation active after init
- **WHEN** `EdotReactNative.initialize()` is called with default config
- **THEN** `global.fetch` is patched
- **THEN** `XMLHttpRequest.prototype.open` and `.send` are patched
- **THEN** subsequent HTTP requests create spans

#### Scenario: Network instrumentation disabled
- **WHEN** `instrumentNetworkRequests: false` is configured
- **THEN** `global.fetch` is NOT patched
- **THEN** `XMLHttpRequest` is NOT patched