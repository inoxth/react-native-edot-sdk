# AGENTS.md — @inox/react-native-edot-tracer-provider

## Overview

OTel-compatible manual instrumentation API. Exposes `getTracerProvider()`, `getMeterProvider()`, and `withSpanContext()` for custom spans and metrics.

## Structure

```
src/
├── index.ts              # Re-exports providers, SpanStatusCode, and types
├── tracer-provider.ts    # TracerProvider → Tracer → Span implementation
├── meter-provider.ts     # MeterProvider → Meter → Counter/Histogram/UpDownCounter
├── types.ts              # OTel-style interfaces + SpanStatusCode enum
└── __tests__/
    ├── tracer-provider.test.ts
    └── meter-provider.test.ts
```

## Key API

### Tracing
- `getTracerProvider()` — singleton `TracerProvider`
- `tracer.startSpan(name, options?)` — creates a span, returns `Span` with `setAttribute()`, `setStatus()`, `recordException()`, `end()`
- `withSpanContext(parentSpan, fn)` — sets implicit parent for spans created inside `fn`
- `SpanStatusCode.OK` (1) / `SpanStatusCode.ERROR` (2)

### Metrics
- `getMeterProvider()` — singleton `MeterProvider`
- `meter.createCounter(name)` / `meter.createHistogram(name)` / `meter.createUpDownCounter(name)`
- Each metric type has an `add()` or `record()` method with optional attributes

## Key Patterns

- Both providers are lazy singletons (created on first call)
- Delegates all operations to `EdotNativeModule` via lazy `require('@inox/react-native-edot-sdk/nativeModule')`
- `withSpanContext` uses module-scoped `contextParentSpan` variable (not async-safe — concurrent async spans may clobber parent)
- Both modules export `resetForTesting()` / `resetMeterForTesting()` to clear singletons and cached native module between tests

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- Peer: `react >=18.0.0`, `react-native >=0.72.0`
