## 1. Shared Instrumentation Utilities

- [x] 1.1 Create `src/instrumentation/urlUtils.ts` — URL sanitization (strip query params), `shouldIgnore(url, ignoreUrls)`, `shouldPropagate(url, targets)`, EDOT server URL exclusion
- [x] 1.2 Create `src/instrumentation/traceContext.ts` — W3C `traceparent` header generation from span ID and trace ID
- [x] 1.3 Create `src/instrumentation/graphql.ts` — GraphQL operation name extraction from request body for matching URLs
- [x] 1.4 Write unit tests for urlUtils (sanitization, ignore matching, propagation matching)
- [x] 1.5 Write unit tests for traceContext (header format validation)
- [x] 1.6 Write unit tests for GraphQL extraction (valid body, invalid body, non-GraphQL URL)

## 2. Fetch Instrumentation

- [x] 2.1 Create `src/instrumentation/fetch.ts` — `setupFetchInstrumentation(config)` that patches `global.fetch`, returns teardown function
- [x] 2.2 Implement span creation with `http.method`, `http.url`, `http.status_code`, `http.request_content_length`, `http.response_content_length` attributes
- [x] 2.3 Implement `traceparent` injection for matching URLs
- [x] 2.4 Implement `X-Edot-RN-Traced: 1` deduplication header
- [x] 2.5 Implement `ignoreUrls` filtering and EDOT server URL exclusion
- [x] 2.6 Implement URL sanitization (default + custom `urlSanitizer`)
- [x] 2.7 Implement GraphQL operation name extraction for matching `graphqlUrls`
- [x] 2.8 Implement error handling — record exception on network failure, re-throw original error
- [x] 2.9 Wrap entire fetch wrapper in try-catch for SDK error isolation
- [x] 2.10 Write unit tests for fetch instrumentation (success, error, ignore, propagation, GraphQL, sanitization)

## 3. XHR Instrumentation

- [x] 3.1 Create `src/instrumentation/xhr.ts` — `setupXhrInstrumentation(config)` that patches `XMLHttpRequest.prototype`, returns teardown function
- [x] 3.2 Implement WeakMap-based per-request state tracking (span ID, method, URL)
- [x] 3.3 Implement span creation on `send`, span end on `load`/`error`/`timeout` events
- [x] 3.4 Implement same trace propagation, deduplication, sanitization, ignore, and GraphQL logic as fetch
- [x] 3.5 Write unit tests for XHR instrumentation

## 4. JS Error Handler

- [x] 4.1 Create `src/instrumentation/errors.ts` — `setupErrorHandler(config)` that installs global error handler and Promise rejection tracker
- [x] 4.2 Implement `ErrorUtils.setGlobalHandler()` with chaining to existing handler
- [x] 4.3 Implement Hermes Promise rejection tracker with JSC fallback
- [x] 4.4 Implement error-to-span conversion with `exception.type`, `exception.message`, `exception.stacktrace`, `error.source`
- [x] 4.5 Implement native error forwarding via `reportJsException()`
- [x] 4.6 Create `src/components/EdotErrorBoundary.tsx` — React error boundary with `fallback` prop
- [x] 4.7 Export `EdotErrorBoundary` from `src/index.ts`
- [x] 4.8 Write unit tests for error handler (uncaught, promise rejection, chaining)
- [x] 4.9 Write unit tests for EdotErrorBoundary (render error, fallback rendering)

## 5. Lifecycle Tracking

- [x] 5.1 Create `src/instrumentation/lifecycle.ts` — `setupLifecycleTracking(config)` that listens to `AppState` changes
- [x] 5.2 Implement span creation for foreground/background/inactive transitions
- [x] 5.3 Write unit tests for lifecycle tracking (state transitions, config toggle)

## 6. Startup Tracing

- [x] 6.1 Create `src/instrumentation/startup.ts` — `setupStartupTracing(config)` that creates cold/warm start spans
- [x] 6.2 Implement native start timestamp retrieval via bridge call
- [x] 6.3 Implement first-render detection via `InteractionManager.runAfterInteractions`
- [x] 6.4 Implement parent `AppStartup` span with child phase spans
- [x] 6.5 Write unit tests for startup tracing

## 7. Span Cleanup

- [x] 7.1 Create `src/instrumentation/spanCleanup.ts` — `setupSpanCleanup()` with 60s interval and 5-minute timeout
- [x] 7.2 Implement span age tracking via `Map<spanId, number>`
- [x] 7.3 Implement cleanup logic (end spans with `DEADLINE_EXCEEDED`)
- [x] 7.4 Write unit tests for span cleanup (timer, expiration, teardown)

## 8. Wire Into Initialize

- [x] 8.1 Update `src/EdotReactNative.ts` — call all `setup*()` functions from `initialize()` based on config toggles
- [x] 8.2 Store teardown functions for cleanup on potential `shutdown()` call
- [x] 8.3 Update `src/index.ts` to export `EdotErrorBoundary`

## 9. Verify

- [x] 9.1 Run `yarn lint` — zero errors
- [x] 9.2 Run `yarn typecheck` — passes
- [x] 9.3 Run `yarn test` — all tests pass
- [x] 9.4 Run `yarn build` — builds successfully
- [x] 9.5 Update example app to demonstrate auto-instrumented fetch request and error boundary
