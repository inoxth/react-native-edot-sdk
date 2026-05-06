# @inox/react-native-edot-tracer-provider

Manual instrumentation API for the EDOT React Native SDK. Provides an OpenTelemetry-compatible `TracerProvider` and `MeterProvider` for emitting custom spans and metrics from JavaScript that flow through the same native pipeline as auto-instrumentation.

Use this when the auto-instrumentation in [`@inox/react-native-edot-sdk`](../react-native) doesn't cover the signal you need — e.g. business events, custom timings, domain-specific metrics.

## Install

```bash
yarn add @inox/react-native-edot-tracer-provider
```

You also need the core SDK initialized first:

```bash
yarn add @inox/react-native-edot-sdk
```

See the [SDK README](../react-native) for native setup (iOS pod install, Android Gradle plugin) and `EdotReactNative.initialize(...)`.

## Custom spans

```typescript
import { getTracerProvider, SpanStatusCode } from '@inox/react-native-edot-tracer-provider';

const tracer = getTracerProvider().getTracer('checkout');

const span = tracer.startSpan('processPayment');
span.setAttribute('payment.method', 'credit_card');
span.setAttribute('payment.amount_cents', 4999);

try {
  await chargeCustomer();
  span.setStatus(SpanStatusCode.OK);
} catch (err) {
  span.setStatus(SpanStatusCode.ERROR, err instanceof Error ? err.message : String(err));
  throw err;
} finally {
  span.end();
}
```

Spans created here automatically include `screen.name` and `screen.id` attributes when an active view is set by the navigation plugin.

### Running code inside a span context

`withSpanContext` propagates the span as the active context for downstream OTel-aware code:

```typescript
import { withSpanContext } from '@inox/react-native-edot-tracer-provider';

await withSpanContext(span, async () => {
  await fetchAccount();
});
```

## Custom metrics

```typescript
import { getMeterProvider } from '@inox/react-native-edot-tracer-provider';

const meter = getMeterProvider().getMeter('business');

const counter = meter.createCounter('orders_placed');
counter.add(1, { region: 'us-east' });

const histogram = meter.createHistogram('checkout_duration_ms');
histogram.record(842, { region: 'us-east' });

const queueDepth = meter.createUpDownCounter('orders_in_queue');
queueDepth.add(1);
queueDepth.add(-1);
```

The MeterProvider exports metrics on a periodic schedule (60s) using the same transport (`http` or `grpc`) configured for the SDK.

## Requirements

- React Native >= 0.72.0
- React >= 18.0.0
- [`@inox/react-native-edot-sdk`](../react-native) initialized at app startup

## License

MIT — see [LICENSE](../../LICENSE).
