# Manual Instrumentation Specification

## Purpose
Expose OpenTelemetry-aligned APIs for custom spans, metrics, and logs.

## Requirements

### TracerProvider
- MUST provide `getTracerProvider()` that returns an OTel-compatible TracerProvider
- MUST provide `getMeterProvider()` for custom metrics
- Tracer MUST support `startSpan(name, options)` with parent context
- MUST provide `withSpanContext(parentSpan, asyncFn)` helper for async context propagation

### Custom Spans
- MUST support `span.setAttribute(key, value)`
- MUST support `span.recordException(error)`
- MUST support `span.setStatus(statusCode)`
- MUST support `span.end()`
- MUST support nested parent-child spans

### Custom Metrics
- MUST support Counter, Histogram, and UpDownCounter metric types
- MUST support metric attributes

### Custom Logs
- MUST provide `EdotReactNative.log(severity, message, attributes)`
- MUST support severity levels: trace, debug, info, warn, error, fatal

### Orphaned Span Cleanup
- MUST run periodic cleanup (every 60s) to end spans older than 5 minutes
- MUST end orphaned spans with status `DEADLINE_EXCEEDED`

### Scenarios

#### Scenario: Custom span for business logic
- **Given** a tracer is obtained via `getTracerProvider().getTracer('checkout')`
- **When** `tracer.startSpan('processPayment')` is called
- **And** `span.setAttribute('payment.method', 'credit_card')` is called
- **And** `span.end()` is called
- **Then** the span is exported with the correct name and attributes