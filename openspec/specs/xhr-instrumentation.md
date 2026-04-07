# XHR Instrumentation Specification

## Purpose
Monkey-patch `XMLHttpRequest` to automatically create OpenTelemetry spans for XHR-based HTTP requests (including Axios) with trace propagation, deduplication, and URL sanitization.

## Requirements

### Requirement: XHR monkey-patching creates spans
The SDK SHALL patch `XMLHttpRequest.prototype.open` and `XMLHttpRequest.prototype.send` to create OTel spans for all XHR-based requests. Per-request state SHALL be stored in a WeakMap keyed by the XHR instance. The span SHALL include the same attributes as fetch spans (`http.method`, `http.url`, `http.status_code`). The span SHALL end on `load`, `error`, or `timeout` events.

#### Scenario: Axios request creates span via XHR
- **WHEN** `axios.get('https://api.example.com/users')` is called
- **THEN** a span is created via the XHR patch
- **THEN** span attributes match the same schema as fetch spans

#### Scenario: XHR error creates error span
- **WHEN** an XHR request fails with a network error
- **THEN** the span records the exception
- **THEN** the span status is ERROR

### Requirement: XHR trace propagation and deduplication
The XHR patch SHALL inject `traceparent` and `X-Edot-RN-Traced: 1` headers using the same rules as fetch instrumentation.

#### Scenario: XHR request includes deduplication header
- **WHEN** any XHR request is sent
- **THEN** the request includes `X-Edot-RN-Traced: 1` header

### Requirement: XHR URL sanitization and filtering
The XHR patch SHALL apply the same URL sanitization, `ignoreUrls` filtering, and GraphQL extraction as fetch instrumentation.

#### Scenario: XHR to ignored URL produces no span
- **WHEN** `ignoreUrls: [/\/health$/]` is configured
- **WHEN** an XHR request to `https://api.example.com/health` is made
- **THEN** no span is created
