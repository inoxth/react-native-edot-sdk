## Context

Phase 2 delivered fetch/XHR auto-instrumentation and JS error tracking. Network spans and error spans exist as flat siblings under a session. The PRD (Section 3.19) specifies view-to-network correlation using OTel span links and `view.name`/`view.id` attributes so that every span can be traced back to the screen that triggered it.

The current codebase has:
- `packages/react-native/src/instrumentation/fetch.ts` — fetch monkey-patching with span creation
- `packages/react-native/src/instrumentation/xhr.ts` — XHR monkey-patching with span creation
- `packages/react-native/src/instrumentation/errors.ts` — JS error/promise rejection handler with span creation
- `packages/react-native/src/nativeModule.ts` — native bridge with `startSpan(name, attributes, parentSpanId)`
- No existing context or view state management

Navigation plugins (React Navigation, Wix, Expo Router) will be implemented in Phase 4 and will call `setActiveView()` from this module.

## Goals / Non-Goals

**Goals:**
- Introduce `ActiveViewContext` as a shared JS-side module that tracks the currently active screen
- Enrich every network span (fetch + XHR) with `view.name`, `view.id` attributes
- Enrich every error span with `view.name` attribute
- Support OTel span links from network/error spans to the active view span
- Export `ActiveViewContext` API for Phase 4 navigation plugins to consume
- Add `addSpanLink` to the native bridge so JS can attach span links after span creation

**Non-Goals:**
- Navigation plugin implementation (Phase 4)
- Custom span auto-linking via TracerProvider wrapper (Phase 4 — `@inox/react-native-edot-tracer-provider`)
- `autoLinkToActiveView` configuration option (Phase 4)
- Native-side view tracking (EDOT native SDKs handle native views separately)

## Decisions

### Decision 1: Span links via attributes rather than native `links` parameter

**Choice**: Attach `view.id` as a span attribute and add a separate `addSpanLink(spanId, linkedSpanContext)` native bridge method, rather than extending `startSpan` with a `links` parameter.

**Rationale**: The current `startSpan` signature is `(name, attributes, parentSpanId)` — adding a `links` array would require changing the TurboModule spec, native iOS and Android implementations, and the no-op fallback. Instead, we:
1. Pass `view.name` and `view.id` as regular attributes in the existing `startSpan` call
2. Add a new `addSpanLink(spanId, linkedTraceId, linkedSpanId)` native bridge method for structural OTel links

This minimizes the blast radius of native bridge changes while still achieving full correlation.

**Alternative considered**: Extending `startSpan` with a `links` parameter. Rejected because it's a larger breaking change to the native interface for a feature that can be achieved incrementally.

### Decision 2: Module-level singleton for ActiveViewContext

**Choice**: Use a simple module-level singleton (`let activeViewContext`) rather than a class or React context.

**Rationale**: The active view context is global state — there's exactly one active screen at any time. The JS thread is single-threaded, so no synchronization is needed. A module singleton is the simplest approach. Navigation plugins in Phase 4 will import and call `setActiveView()` directly.

**Alternative considered**: React Context / Provider pattern. Rejected because network interceptors (fetch/XHR monkey-patches) run outside the React tree and cannot access React context.

### Decision 3: SpanContext type definition in core

**Choice**: Define `SpanContext` as `{ traceId: string; spanId: string }` in the core types module.

**Rationale**: This is the minimal OTel span context needed for span links. The `traceId` + `spanId` pair identifies any span for linking. We don't need full OTel `SpanContext` (with traceFlags, traceState) since those are managed by the native SDK.

### Decision 4: View context remains set during navigation transitions

**Choice**: When a new screen appears, `setActiveView()` replaces the previous view atomically. There is no `clearActiveView()` call between screens.

**Rationale**: During the brief transition gap (~16ms between navigation event and new screen render), network spans link to the previous view. This is acceptable — the alternative (a null gap) would produce unlinked spans, which is worse.

## Risks / Trade-offs

**[Risk] Native bridge does not support span links natively** → The EDOT native SDKs may not expose an API to add links after span creation. Mitigation: `view.name` and `view.id` as flat attributes provide 90% of the correlation value (queryable in Kibana). The `addSpanLink` bridge method is best-effort; if the native SDK doesn't support it, we skip the structural link and rely on attribute-based correlation.

**[Risk] In-flight requests during navigation see stale view context** → A fetch started on Screen A that completes after navigating to Screen B will be linked to Screen A. This is actually correct behavior — the request was initiated from Screen A.

**[Trade-off] No custom span auto-linking in Phase 3** → Custom spans created via the TracerProvider will not automatically link to the active view until Phase 4 delivers the TracerProvider wrapper. Acceptable because Phase 3 focuses on auto-instrumented spans.
