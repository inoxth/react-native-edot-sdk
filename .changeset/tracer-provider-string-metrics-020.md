---
"@inoxth/react-native-edot-tracer-provider": minor
---

**Breaking:** metric attributes are now **string-only**. `Counter.add`, `Histogram.record`, and `UpDownCounter.add` take `Record<string, string>` instead of `Record<string, string | number | boolean>`. iOS apm-agent-ios 1.2.1's legacy meter supports only string labels, and aligning both platforms avoids the same call producing mixed-typed metric series. Span attributes (`SpanOptions` / `Span.setAttribute`) are unchanged.

Released in lockstep at **0.2.0** with the rest of the suite.

Migration: convert numeric/boolean metric-attribute values to strings (e.g. `counter.add(1, { count: String(n) })`).
