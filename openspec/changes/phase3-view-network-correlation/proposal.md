## Why

Phase 2 implemented network auto-instrumentation (fetch/XHR spans) and the PRD specifies navigation tracking in Phase 4. However, without view-to-network correlation, these spans are flat siblings under the same session — queryable only by overlapping timestamps, not by structural relationship. Phase 3 bridges this gap by introducing an `ActiveViewContext` module and span link mechanism so that every network span, error span, and custom span is correlated to the screen where it was triggered. This enables Kibana queries like "which APIs does ProductDetailScreen call?" and "which screen has the most errors?"

## What Changes

- Add `ActiveViewContext` module to the core package (`setActiveView`, `getActiveViewContext`, `getActiveViewName`, `clearActiveView`)
- Modify fetch instrumentation to attach `view.name`, `view.id` attributes and OTel span links to every network span
- Modify XHR instrumentation with the same view correlation attributes and span links
- Modify error handler to attach `view.name` and span links to every JS error span
- Export `ActiveViewContext` API from core package for navigation plugins to consume in Phase 4
- Add unit tests for all correlation scenarios (active view present, no view set, navigation during in-flight request)

## Capabilities

### New Capabilities
- `view-correlation`: Active view context tracking and span correlation — manages shared state for the currently active screen and enriches network/error/custom spans with view attributes and span links

### Modified Capabilities
- `fetch-instrumentation`: Add `view.name`, `view.id` attributes and span links to active view on every fetch span
- `xhr-instrumentation`: Add `view.name`, `view.id` attributes and span links to active view on every XHR span

## Impact

- **Core package**: New `ActiveViewContext` module added to `packages/react-native/src/context/`
- **Fetch instrumentation**: `packages/react-native/src/instrumentation/fetch.ts` modified to read active view context
- **XHR instrumentation**: `packages/react-native/src/instrumentation/xhr.ts` modified to read active view context
- **Error handler**: `packages/react-native/src/instrumentation/errors.ts` modified to attach view context to error spans
- **Public API**: `setActiveView`, `getActiveViewContext`, `getActiveViewName` exported from core for navigation plugin packages
- **Native module**: `startSpan` calls gain `links` parameter for OTel span links (native bridge addition)
- **Types**: New `SpanContext` and `SpanLink` types added to `types.ts`
