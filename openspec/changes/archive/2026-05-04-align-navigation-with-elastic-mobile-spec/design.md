## Context

The EDOT React Native SDK currently emits navigation telemetry that diverges from both Elastic mobile agents on three independent axes:

1. **Attribute names**: nav plugins emit `view.name` / `view.previous` / `view.transition_type`. apm-agent-android (via opentelemetry-android) emits `screen.name` / `last.screen.name`. apm-agent-ios encodes screen identity in the span name. Kibana mobile RUM views key off `screen.name`.
2. **Span lifecycle**: nav plugins emit a screen-lifetime span (one span per screen visit), but it never ends on app background — so duration includes background time and `screen.id` correlation tags background-originated work to a stale screen.
3. **Tracer scope**: every span goes through one tracer named `"react-native-edot"`, regardless of signal. Kibana cannot filter by `instrumentation.scope.name` per-signal as it can with apm-agent-ios's per-instrumentation tracers.

The grilling session that produced this design verified attribute and span shapes by reading apm-agent-ios source (`Sources/apm-agent-ios/Instrumentation/ViewController/ViewControllerInstrumentation.swift`, `OpenTelementry Extensions/ElasticSpanProcessor.swift`), opentelemetry-android source (`core/src/main/java/io/opentelemetry/android/ScreenAttributesSpanProcessor.kt`, `instrumentation-shared/.../RumConstants.kt`), and the URLSessionInstrumentation contract from opentelemetry-swift. apm-agent-ios's own `ViewControllerInstrumentation` adds **zero** view-related attributes — it relies entirely on the span name. opentelemetry-android adds `screen.name` to **every** span via `ScreenAttributesSpanProcessor.onStart`, which is on by default. Neither agent emits `view.transition_type`.

The SDK is not yet published, so this is an unconstrained design moment. No dual-emit / version-bump shim is required.

## Goals / Non-Goals

**Goals:**

- Wire-format parity with apm-agent-android for screen identity attributes (`screen.name`, `last.screen.name`).
- Active-screen-time signal that reflects only foreground time.
- Per-signal `instrumentation.scope.name` filterability in Kibana, mirroring apm-agent-ios's tracer split.
- A single OpenSpec change covering the SDK, three navigation plugins, native bridge, and shared package.

**Non-Goals:**

- Render-time view spans equivalent to apm-agent-ios's `viewWillAppear`→`viewDidAppear` swizzling. RN can't produce them faithfully without per-platform native swizzling we don't do.
- Native iOS `SpanProcessor` to enrich purely native-originated spans (lifecycle, AppMetrics, CrashReporting) with `screen.name`. Documented as a deliberate gap; revisit if a real third-party-native-URLSession use case appears.
- Per-screen `reportName(_:)`-style override API. Global `screenNameMapper` covers PII redaction; per-screen override has ordering complexity and no clear demand.
- Backwards-compat / dual-emit period. SDK is unpublished.

## Decisions

### D1. Keep screen-lifetime span model (vs. iOS render-time / Android per-transition)

**Decision:** A single span per screen visit, ending on the next navigation or app-background.

**Alternatives considered:**

- Match apm-agent-ios's render-time spans (`viewWillAppear`→`viewDidAppear`). Rejected — RN's nav plugins can only observe at the JS level (`onStateChange`, `usePathname`, `componentDidAppear`), so we'd emit zero-duration spans with bogus timings.
- Match apm-agent-android's per-transition spans (bare verbs `Created`, `Resumed`, `Paused`). Rejected — JS-level nav events don't expose pre/post hooks for each lifecycle phase, and the bare-verb name carries no screen identity at the span-name level.

**Rationale:** Screen-lifetime is the only model RN can produce honestly from JS-level navigation events, and it's strictly more useful for `screen.name` / `screen.id` correlation on HTTP and error spans.

### D2. Use `screen.name` and `last.screen.name`; drop `view.transition_type`

**Decision:** Rename `view.name` → `screen.name`, `view.previous` → `last.screen.name`. Remove `view.transition_type`. Span kind `INTERNAL` (matches Android upstream).

**Alternatives considered:**

- Keep `view.*` and document divergence. Rejected — Kibana mobile RUM views correlate on `screen.name`; we'd lose auto-correlation.
- Emit both `view.*` and `screen.*` for a transition. Rejected — SDK is unpublished, no migration tail; doubling test surface and wire bytes for no reader benefit.
- Replace `view.transition_type` with a span event (e.g. `screen.appeared` with `start.type`). Rejected — neither Elastic agent emits anything analogous; transition type is redundant with the span itself (one span per appearance).

### D3. Span name format: plain `<ScreenName>`

**Decision:** Span name is the screen name itself (e.g. `"HomeScreen"`, `"ProductDetail"`, `"/products/42"`), not `"Navigation: <ScreenName>"`.

**Alternatives considered:**

- Keep `"Navigation: <ScreenName>"`. Rejected — the `"Navigation: "` prefix is dead weight in Kibana span lists; filtering navigation spans is what `screen.name` attribute and instrumentation scope are for.
- Match iOS's `"<ScreenName> - view appearing"`. Rejected — that suffix encodes render-time semantics, which we don't have.
- Match Android's bare verb (`"Resumed"`). Rejected — bare verbs without screen identity make span-list browsing useless.

**Trade-off:** Plain screen names can theoretically collide with app-defined custom spans of the same name. Disambiguated by `screen.name` attribute and the per-plugin instrumentation scope (D5). Acceptable.

### D4. Propagate `screen.id` to fetch/XHR/error/interaction spans

**Decision:** When `ActiveViewContext.getActiveView()` is non-null, instrumentation enriches spans with `screen.name` (the active screen name) and `screen.id` (the active screen-lifetime span's ID). This mirrors opentelemetry-android's `ScreenAttributesSpanProcessor` behavior at the JS layer (since iOS has no equivalent processor).

**Alternatives considered:**

- Drop the `view.id` → `screen.id` rename and rely solely on `screen.name + session.id`. Rejected — those don't disambiguate two visits to the same screen within one session, and existing tests already validate the disambiguation signal.
- Use OTel parent-span context: set the screen-lifetime span as the parent of fetch/XHR. Rejected — `packages/react-native/ios/AGENTS.md` flags `parentSpanId: null` as load-bearing; `ElasticSpanProcessor` builds a synthetic parent transaction for parentless spans, and changing that contract breaks iOS transaction wrapping.

**Trade-off:** `screen.id` is a custom attribute (not OTel mobile semconv). Aligned with the `screen.*` prefix family; documented in network/error/interactions specs.

### D5. Per-instrumentation tracer scope via optional bridge parameter

**Decision:** Add an optional `instrumentationName: string | null` 4th parameter to `startSpan` and `startClientSpan` on:

- TurboModule spec (`NativeEdotReactNative.ts`)
- iOS legacy bridge (`EdotReactNative.m`'s `RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD` declarations) and Swift impl (replace cached `tracer` property with `func tracer(named:)`)
- Android oldarch `@ReactMethod` (`packages/react-native/android/src/oldarch/.../EdotReactNativeModule.kt`), newarch `override fun` (`src/newarch/.../EdotReactNativeModule.kt`), shared impl (`EdotReactNativeModuleImpl.kt`)

Default to `"react-native-edot"` when omitted (no callsite breakage).

JS callsites updated:

| Callsite | Scope |
|---|---|
| `react-native-navigation` | `@inox/react-native-edot-navigation` |
| `react-native-expo-router` | `@inox/react-native-edot-expo-router` |
| `react-native-wix-navigation` | `@inox/react-native-edot-wix-navigation` |
| fetch.ts | `@inox/react-native-edot-sdk/fetch` |
| xhr.ts | `@inox/react-native-edot-sdk/xhr` |
| errors.ts | `@inox/react-native-edot-sdk/errors` |
| startup (`lifecycle.ts`) | `@inox/react-native-edot-sdk/startup` |
| tracer-provider | user-supplied |

**Side fix:** Android oldarch is missing a `startClientSpan` `@ReactMethod` entirely (iOS-only on legacy). Add it as part of this change so the tracer-name plumbing applies symmetrically across architectures.

**Alternatives considered:**

- Match apm-agent-ios's exact tracer name (`"UIViewController"`) for navigation spans. Rejected — there's no UIViewController on RN; misnaming the scope hurts debuggability and Kibana cross-platform views can union scopes via dashboard query.
- Add an `edot.instrumentation` attribute on every span instead of using the standard `instrumentation.scope.name`. Rejected — non-standard, requires Kibana custom queries; OTel scope is the right primitive.

### D6. App-state lifecycle: end on background, restart on foreground

**Decision:** SDK package owns a single `AppState` listener (new `packages/react-native/src/instrumentation/app-state.ts`). On `'background'` (NOT `'inactive'`) it ends the active screen-lifetime span via `EdotNativeModule.endSpan(spanId, 1)` and clears `ActiveViewContext`. On `'active'` after a real background it invokes registered foreground re-emitters.

`@inox/react-native-edot-shared` adds `ActiveViewContext.registerForegroundReEmitter(fn): () => void`. Plugins register at construction; SDK iterates registered re-emitters on foreground. Each plugin's re-emitter resets its `previousScreenName = null` (so the new span omits `last.screen.name`, treating the foreground as a fresh visit) then re-runs its first-emission path:

- React Navigation: read `navigationRef.current.getCurrentRoute()` live
- Expo Router: stash latest pathname in a ref, read on re-emit
- Wix: remember last `componentDidAppear` event in module state, replay it

Gated by new `EDOT_DEFAULTS.appStateTracking: true`.

**Alternatives considered:**

- Status quo: do nothing on app-state changes. Rejected — screen-lifetime spans include background time, making `duration` meaningless and `screen.id` tag stale.
- Heuristic threshold: end only after backgrounded > N seconds. Rejected — adds a tunable parameter, edge cases, and tests for marginal benefit; brief multitasking returning quickly is correctly modeled as "the screen was unfocused".
- Per-plugin AppState listeners. Rejected — duplicates listener installation, two teardown paths, two lifecycle-policy sites; SDK ownership centralizes the policy.
- Act on `'inactive'` too. Rejected — iOS fires `'inactive'` on Face ID prompts, native alerts, app-switcher half-pulled, and other transient states; thrashing spans hurts data quality.

**Trade-off:** Foregrounding back to the same screen produces a new `screen.id`. Network requests started before background carry the old (now-ended) `screen.id`. This is correct: the request is associated with the screen-session it started in.

### D7. JS-side enrichment only (no native iOS SpanProcessor)

**Decision:** `screen.name` enrichment of fetch/XHR/error/interaction spans happens in JS via `ActiveViewContext`. iOS native does not install an equivalent of opentelemetry-android's `ScreenAttributesSpanProcessor`.

**Alternatives considered:**

- Add `EdotScreenAttributesSpanProcessor` on iOS that reads from a native mirror of `ActiveViewContext`. Rejected (for now) — adds JS→native bridge call on every navigation, more native pipeline complexity adjacent to the load-bearing `parentSpanId: null` synthetic-transaction logic, and the spans that would benefit (native lifecycle, AppMetrics, CrashReporting) don't have meaningful screen-correlation semantics. Revisit if a real third-party-native-URLSession use case appears.

**Documented gap:** native-only iOS spans (lifecycle events, AppMetrics, CrashReporting, third-party native URLSession) will not carry `screen.name`. Recorded in `packages/react-native/ios/AGENTS.md`.

## Risks / Trade-offs

- **Breaking wire-format change** → Mitigation: SDK is unpublished. Single major bump implicit (no externally-deployed dashboards to migrate). Tests and AGENTS.md migrated atomically in this change.
- **Test surface churn** (every Jest assertion that reads `view.*` attributes needs an update) → Mitigation: mechanical search-and-replace; oxlint string-literal rule (or grep test) added to prevent regressions of `view.name`/`view.previous`/`view.transition_type` usage outside of historical OpenSpec archives.
- **Foreground re-emit relies on per-plugin replay strategies** → Mitigation: each plugin's replay path is testable in isolation; failures degrade gracefully (no span emitted) rather than crashing.
- **Wix-specific replay** stores last component event in module state → Mitigation: cleared on plugin unregister; reset across `_resetForTesting()`; documented in plugin AGENTS.md.
- **Native iOS gap** for purely-native spans → Mitigation: documented; defer until concrete need.
- **TurboModule spec change requires codegen regeneration** for Android newarch → Mitigation: standard part of the build; verified by `yarn build` in tasks.
- **`'inactive'` filtering nuance** (iOS fires `inactive → background → inactive → active` on multitask) → Mitigation: track a `wasBackgrounded` flag inside the AppState handler; only re-emit on `'active'` if we previously saw `'background'`. Test cases cover both paths.

## Migration Plan

This is an internal refactor of an unpublished package set. No external migration is required.

In-repo migration steps:

1. Land `align-navigation-with-elastic-mobile-spec` change — single PR per OpenSpec workflow.
2. Update example apps' (`example/react-navigation`, `example/expo-router`, `example/wix-navigation`, `example/basic`) Jest tests if they assert on `view.*`.
3. Run `yarn typecheck && yarn test && yarn lint && yarn fmt` across the monorepo.
4. Update root and per-package `AGENTS.md` and `CLAUDE.md` files as part of the change tasks.
5. Archive the OpenSpec change after verification.

Rollback: revert the single PR. No persistent state migration is required (all changes are wire-format and code-level).

## Open Questions

None. All decision points were resolved during the grilling session preceding this proposal.
