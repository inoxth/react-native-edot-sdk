# tracer-provider

## Purpose

Exposes the OTel-compatible TracerProvider and MeterProvider APIs for manual instrumentation, allowing app developers to create custom spans and record metrics via the native bridge.

## Requirements

### Requirement: TracerProvider factory
The package SHALL export `getTracerProvider()` that returns a `TracerProvider` object. The TracerProvider SHALL provide `getTracer(name: string, version?: string)` that returns a `Tracer` instance.

#### Scenario: Obtain a tracer
- **WHEN** `getTracerProvider().getTracer('checkout', '1.0.0')` is called
- **THEN** it returns a `Tracer` instance scoped to the `checkout` instrumentation

### Requirement: Span lifecycle
The `Tracer` SHALL provide `startSpan(name: string, options?: SpanOptions)` that creates a span via the native bridge and returns a `Span` object. `SpanOptions` SHALL support `attributes` and `parentSpan`. The `Span` SHALL support `setAttribute(key, value)`, `setStatus(statusCode)`, `recordException(error)`, `end()`, and expose `spanId: string`.

#### Scenario: Custom span for business logic
- **WHEN** `tracer.startSpan('processPayment', { attributes: { 'payment.method': 'credit_card' } })` is called
- **AND** `span.end()` is called
- **THEN** the native bridge receives a span with name `processPayment` and the given attributes

#### Scenario: Span with parent
- **WHEN** `tracer.startSpan('validateCart', { parentSpan })` is called
- **THEN** the created span has `parentSpan.spanId` as its parent

### Requirement: Span status and exceptions
The `Span` SHALL support `setStatus(code: SpanStatusCode)` with values `OK` (1) and `ERROR` (2). It SHALL support `recordException(error: Error)` which records the exception on the native span.

#### Scenario: Error span
- **WHEN** `span.recordException(new Error('Payment failed'))` is called
- **AND** `span.setStatus(SpanStatusCode.ERROR)` is called
- **AND** `span.end()` is called
- **THEN** the span is exported with error status and the exception recorded

### Requirement: MeterProvider factory
The package SHALL export `getMeterProvider()` that returns a `MeterProvider` object. The MeterProvider SHALL provide `getMeter(name: string, version?: string)` that returns a `Meter` instance.

#### Scenario: Obtain a meter
- **WHEN** `getMeterProvider().getMeter('app-metrics', '1.0.0')` is called
- **THEN** it returns a `Meter` instance

### Requirement: Metric instruments
The `Meter` SHALL support `createCounter(name)`, `createHistogram(name)`, and `createUpDownCounter(name)`. Each instrument SHALL support `.add(value, attributes?)` (counter/updowncounter) or `.record(value, attributes?)` (histogram). These SHALL delegate to `EdotNativeModule.recordMetric()`.

#### Scenario: Counter increment
- **WHEN** `meter.createCounter('cart.items_added')` is called
- **AND** `counter.add(1, { 'item.category': 'electronics' })` is called
- **THEN** `EdotNativeModule.recordMetric` is called with name `cart.items_added`, value 1, attributes, and type `counter`

#### Scenario: Histogram recording
- **WHEN** `meter.createHistogram('api.latency_ms')` is called
- **AND** `histogram.record(145, { 'api.endpoint': '/checkout' })` is called
- **THEN** `EdotNativeModule.recordMetric` is called with name `api.latency_ms`, value 145, and type `histogram`

### Requirement: Async context propagation
The package SHALL export `withSpanContext(parentSpan: Span, fn: () => T | Promise<T>): T | Promise<T>`. Spans created within `fn` SHALL automatically parent to `parentSpan` without explicit `parentSpan` in options.

#### Scenario: Automatic parent propagation
- **WHEN** `withSpanContext(parentSpan, () => tracer.startSpan('child'))` is called
- **THEN** the `child` span has `parentSpan` as its parent

### Requirement: SpanStatusCode enum
The package SHALL export `SpanStatusCode` with `OK = 1` and `ERROR = 2` matching OTel conventions.

#### Scenario: Status code values
- **WHEN** `SpanStatusCode.OK` is referenced
- **THEN** its value is `1`
- **AND** `SpanStatusCode.ERROR` has value `2`
