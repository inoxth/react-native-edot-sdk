## Context

Phase 1 established the native bridge, `EdotReactNative.initialize()`, and the span creation API (`startSpan`/`endSpan` via native module). Phase 2 uses these primitives to build JS-side auto-instrumentation. All instrumentation runs on the JS thread and communicates with the native EDOT agent via the bridge established in Phase 1.

## Goals / Non-Goals

**Goals:**
- Auto-capture all JS-initiated network requests (fetch + XHR) as OTel spans
- Auto-capture JS errors, promise rejections, and React render errors
- Track app lifecycle transitions and startup performance
- Ensure all instrumentation is safe (never crashes the host app)
- Wire everything into `initialize()` based on config toggles

**Non-Goals:**
- Navigation tracking (Phase 3 — separate packages)
- Manual instrumentation APIs / TracerProvider (Phase 3)
- Tracking consent buffering (Phase 3)
- Native-only instrumentation (ANR, MetricKit) — handled by EDOT native SDKs

## Decisions

### 1. Instrumentation module pattern: Setup functions called from initialize()

**Decision**: Each instrumentation area is a standalone module exporting a `setup*()` function (e.g., `setupFetchInstrumentation(config)`) called from `EdotReactNative.initialize()` when the corresponding config toggle is `true`. Each function returns a `teardown()` function for cleanup.

**Rationale**: Keeps instrumentation modular and testable. Each module can be unit-tested independently by calling its setup function with a mock config. The teardown pattern allows clean shutdown and prevents stale patches.

### 2. Fetch instrumentation: Replace global.fetch, preserve original

**Decision**: Store `global.fetch` reference before patching. The replacement function creates a span, optionally injects `traceparent`, calls the original, and records the response. The `X-Edot-RN-Traced: 1` header is always added to prevent native-side duplicate spans.

**Rationale**: This is the standard approach used by DataDog RN SDK, Embrace SDK, and Sentry RN SDK. Storing the original reference ensures we can restore it on teardown and that our patch doesn't break if called before initialization.

### 3. XHR instrumentation: Patch prototype methods

**Decision**: Patch `XMLHttpRequest.prototype.open` and `XMLHttpRequest.prototype.send`. On `open`, capture method + URL. On `send`, start the span and attach `load`/`error`/`timeout` listeners to end it. Use a WeakMap keyed by XHR instance to store per-request state (span ID, method, URL).

**Rationale**: Patching the prototype ensures all XHR instances (including those created by Axios) are intercepted. A WeakMap avoids memory leaks — state is GC'd when the XHR instance is collected.

### 4. URL sanitization: Strip query params by default, composable sanitizer

**Decision**: The default sanitizer removes query strings from URLs before recording as span attributes. If `config.urlSanitizer` is provided, it runs after the default sanitizer. The EDOT server URL is always excluded from instrumentation.

**Rationale**: Query params frequently contain tokens, user IDs, and PII. Stripping by default is the safe choice per GDPR. The composable approach (default + custom) means users only need to handle their app-specific PII patterns.

### 5. Error handler: Chain with existing handlers

**Decision**: Use `ErrorUtils.getGlobalHandler()` to capture the existing handler, then `ErrorUtils.setGlobalHandler()` to install ours. Our handler records the error as a span, forwards to native, then calls the original handler. Same chaining pattern for Promise rejection tracker.

**Rationale**: Chaining preserves existing error handling (React Native's red screen in dev, crash reporting SDKs). The SDK must not swallow errors or prevent other error handlers from running.

### 6. Startup tracing: Native timestamp + JS timestamp + first render callback

**Decision**: Record `Date.now()` at the start of `initialize()` as the JS bundle loaded timestamp. Request the native start timestamp via a bridge call. Register a first-render callback via `InteractionManager.runAfterInteractions`. Create an `AppStartup` parent span with child spans for each phase.

**Rationale**: The native timestamp captures the true app start (before JS loads). The JS timestamp captures when the bundle is ready. The InteractionManager callback fires after the first meaningful render. Together, these three points define the cold start timeline.

### 7. Span cleanup: setInterval with WeakRef-based tracking

**Decision**: Maintain a `Map<spanId, number>` (spanId → startTimestamp) for all active JS-initiated spans. Run `setInterval` every 60 seconds to find spans older than 5 minutes and end them with `DEADLINE_EXCEEDED` status. Clear the interval on teardown.

**Rationale**: Simple and effective. The 5-minute timeout is generous enough to avoid false positives on slow operations while catching genuinely leaked spans.

## Risks / Trade-offs

**[Fetch patching conflicts]** Other SDKs (Sentry, DataDog) also patch `global.fetch`. Order matters — last patch wins for the outermost wrapper.
→ **Mitigation**: Apply patches in `initialize()` which should be called early (in `index.js`). Document that EDOT should be initialized before other telemetry SDKs.

**[XHR WeakMap memory]** WeakMap entries for XHR instances that never complete (aborted requests) stay until GC.
→ **Mitigation**: Acceptable — the span cleanup timer handles the OTel-side leak. The WeakMap itself doesn't prevent GC of the XHR instance.

**[GraphQL body parsing overhead]** Parsing request bodies for GraphQL operation names adds latency to every POST to `graphqlUrls`.
→ **Mitigation**: Only parse if URL matches `graphqlUrls` config. Use a fast JSON.parse with try-catch — if it fails, fall back to default span naming. No regex on the body.

**[Promise rejection tracker on non-Hermes]** `HermesInternal.enablePromiseRejectionTracker` is Hermes-only. JSC uses a different mechanism.
→ **Mitigation**: Check for Hermes first. Fall back to `require('promise/setimmediate/rejection-tracking')` which works on both engines.
