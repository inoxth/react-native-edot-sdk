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
- Delegates all operations to `EdotNativeModule` via `getNativeModule()` from `@inox/react-native-edot-shared`. The shared accessor lazy-`require()`s `@inox/react-native-edot-sdk/nativeModule` and caches the result, breaking the dependency cycle that would form if this package imported the SDK directly
- `withSpanContext` uses a module-scoped `contextStack: Span[]` (stack-based). Push on entry, pop in `finally`. Detects async interleave: if the top of the stack on exit differs from what was pushed, a `console.warn` fires and the mismatched entry is spliced out to keep the stack balanced. Still not safe across truly concurrent async boundaries — pass `parentSpan` explicitly in `SpanOptions` for async code.
- Metric attributes are passed to `recordMetric` with their original `string | number | boolean` types (no stringification). The native module (`iOS`/`Android`) currently only reads string-typed attributes and silently drops numbers/booleans — tracked as **F-17b** (native follow-up).
- Both modules export `resetForTesting()` / `resetMeterForTesting()` to clear singletons and cached native module between tests

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- Peer: `react >=18.0.0`, `react-native >=0.72.0`
