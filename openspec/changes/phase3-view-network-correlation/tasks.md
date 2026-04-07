## 1. Types & ActiveViewContext Module

- [x] 1.1 Add `SpanContext` interface (`traceId`, `spanId`) to `packages/react-native/src/types.ts`
- [x] 1.2 Create `packages/react-native/src/context/ActiveViewContext.ts` with `setActiveView`, `getActiveViewContext`, `getActiveViewName`, `clearActiveView`
- [x] 1.3 Export `ActiveViewContext` functions from `packages/react-native/src/index.ts`

## 2. Native Bridge Extension

- [x] 2.1 Add `addSpanLink(spanId: string, linkedTraceId: string, linkedSpanId: string): void` to `NativeEdotReactNative.ts` TurboModule spec
- [x] 2.2 Add `addSpanLink` to the no-op module proxy in `nativeModule.ts` (already handled by Proxy catch-all)

## 3. Fetch Instrumentation — View Correlation

- [x] 3.1 Modify `setupFetchInstrumentation` in `fetch.ts` to capture active view context at request start and pass `view.name`/`view.id` as span attributes in `startSpan`
- [x] 3.2 Add `addSpanLink` call after `startSpan` when active view context exists

## 4. XHR Instrumentation — View Correlation

- [x] 4.1 Modify `setupXhrInstrumentation` in `xhr.ts` to capture active view context at `send` time and pass `view.name`/`view.id` as span attributes in `startSpan`
- [x] 4.2 Add `addSpanLink` call after `startSpan` when active view context exists

## 5. Error Handler — View Correlation

- [x] 5.1 Modify `reportError` in `errors.ts` to attach `view.name` and `view.id` attributes from active view context to error spans

## 6. Tests

- [x] 6.1 Add unit tests for `ActiveViewContext` — set, replace, clear, initial null state
- [x] 6.2 Add unit tests for fetch view correlation — with active view, without active view, navigation during in-flight request
- [x] 6.3 Add unit tests for XHR view correlation — with active view, without active view, view captured at send time
- [x] 6.4 Add unit tests for error handler view correlation — error with active view, error without active view
