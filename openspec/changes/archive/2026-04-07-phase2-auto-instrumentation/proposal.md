## Why

With the Phase 1 foundation in place (native modules, initialization, session management), the SDK needs automatic instrumentation to provide value without requiring manual code changes from consumers. Phase 2 adds the core auto-instrumentation capabilities that capture network requests, JS errors, app lifecycle events, and startup performance — the features that make the SDK useful out of the box.

## What Changes

- Implement fetch monkey-patching to create OTel spans for all outgoing HTTP requests
- Implement XMLHttpRequest monkey-patching to capture XHR-based requests (Axios, etc.)
- Add W3C `traceparent` header injection for distributed tracing
- Add `X-Edot-RN-Traced: 1` header for JS/native span deduplication
- Add URL sanitization (default query param stripping + custom `urlSanitizer` callback)
- Add GraphQL operation name extraction for `graphqlUrls`
- Add `ignoreUrls` filtering to skip instrumentation for matching URLs
- Implement global JS error handler via `ErrorUtils.setGlobalHandler()`
- Implement unhandled Promise rejection tracking via Hermes rejection tracker
- Implement `EdotErrorBoundary` React component for render error capture
- Forward JS errors to native module for session-level crash correlation
- Implement AppState lifecycle tracking (foreground/background/inactive spans)
- Implement app startup tracing (cold/warm start with JS bundle load + first render phases)
- Implement orphaned span cleanup timer (60s interval, 5min timeout)
- Wrap all SDK instrumentation code in try-catch for error isolation

## Capabilities

### New Capabilities
- `fetch-instrumentation`: Monkey-patching `global.fetch` with span creation, trace propagation, URL sanitization, GraphQL extraction, and deduplication header
- `xhr-instrumentation`: Monkey-patching `XMLHttpRequest` with the same span creation pattern as fetch
- `js-error-handler`: Global JS error capture, Promise rejection tracking, and `EdotErrorBoundary` component
- `lifecycle-tracking`: AppState-based lifecycle span creation (foreground, background, inactive)
- `startup-tracing`: Cold/warm start span with child spans for native init, JS bundle load, and first render
- `span-cleanup`: Orphaned span cleanup timer and SDK error isolation

### Modified Capabilities
- `network-instrumentation`: Implementing all requirements from the existing spec (fetch, XHR, trace propagation, deduplication, GraphQL)
- `error-tracking`: Implementing JS error handler, EdotErrorBoundary, and native crash forwarding verification

## Impact

- **New source files**: `src/instrumentation/fetch.ts`, `src/instrumentation/xhr.ts`, `src/instrumentation/errors.ts`, `src/instrumentation/lifecycle.ts`, `src/instrumentation/startup.ts`, `src/instrumentation/spanCleanup.ts`, `src/components/EdotErrorBoundary.tsx`
- **Modified files**: `src/EdotReactNative.ts` (wire up all instrumentation in `initialize()`)
- **New dependency**: None (all implemented in pure JS using existing native bridge)
- **Config fields used**: `instrumentNetworkRequests`, `instrumentJsErrors`, `instrumentAppLifecycle`, `instrumentAppStartup`, `tracePropagationTargets`, `ignoreUrls`, `urlSanitizer`, `graphqlUrls`, `debug`
