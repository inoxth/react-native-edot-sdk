## Why

Our three navigation plugins (`react-native-navigation`, `react-native-expo-router`, `react-native-wix-navigation`) emit screen-tracking spans with attribute names (`view.name`, `view.previous`, `view.transition_type`) and a span-name format (`"Navigation: <ScreenName>"`) that diverge from both Elastic mobile agents. apm-agent-android (via opentelemetry-android) uses `screen.name` / `last.screen.name` and apm-agent-ios encodes the screen identity in the span name. Kibana mobile RUM views key off `screen.name`, so our spans currently don't auto-correlate with iOS/Android signals. Additionally, screen-lifetime spans run indefinitely through app-background time, skewing duration metrics and tagging unrelated background work to a stale `screen.id`. Per-instrumentation tracer scope is also collapsed into a single `"react-native-edot"` tracer on both bridges, which prevents per-signal filtering in Kibana.

## What Changes

- **BREAKING** Rename navigation-span attributes: `view.name` → `screen.name`, `view.previous` → `last.screen.name`. Drop `view.transition_type` (no Elastic-agent peer).
- **BREAKING** Rename network/error/interaction enrichment attributes: `view.name` → `screen.name`, `view.id` → `screen.id` on fetch, XHR, error, and interaction spans.
- **BREAKING** Change navigation span name format from `"Navigation: <ScreenName>"` to plain `<ScreenName>`.
- Set navigation span kind to `INTERNAL` (matches Android upstream; was implicit default).
- Set `last.screen.name` only when a prior screen exists *and* differs from the new screen (matches opentelemetry-android semantics).
- Add app-state lifecycle handling: end the active screen-lifetime span on `AppState === 'background'`, restart it on `'active'` after a background. Ignore `'inactive'` (transient phone-call / control-center / app-switcher states). Foreground re-emit treats the screen as a fresh visit (no `last.screen.name`). New `appStateTracking` defaults flag (default `true`).
- Add `ActiveViewContext.registerForegroundReEmitter(fn)` API in `@inox/react-native-edot-shared` so plugins can register their own re-emit logic; SDK owns the single `AppState` listener.
- **BREAKING** Native bridge: add optional `instrumentationName: string | null` parameter to `startSpan` and `startClientSpan` on the TurboModule spec, iOS legacy `.m`/Swift impl, and Android oldarch/newarch/shared impl. Each callsite passes its own scope (`@inox/react-native-edot-navigation`, `@inox/react-native-edot-sdk/fetch`, etc.). Default `"react-native-edot"` when omitted.
- Add the missing `startClientSpan` legacy `@ReactMethod` to Android oldarch (currently iOS-only on the legacy bridge).
- Update specs and AGENTS docs across all affected packages.

## Capabilities

### New Capabilities
- `app-state-tracking`: Lifecycle handling that ends the active screen-lifetime span on background and re-emits the current screen on foreground, with `'inactive'` filtered out.

### Modified Capabilities
- `navigation-tracking`: General navigation-tracking requirements rewritten — attribute names, span name format, span kind, `last.screen.name` semantics.
- `react-navigation-plugin`: Plugin-specific behaviour including foreground re-emit via `navigationRef.current.getCurrentRoute()`.
- `expo-router-plugin`: Plugin-specific behaviour including foreground re-emit from a stashed pathname ref.
- `wix-navigation-plugin`: Plugin-specific behaviour including foreground re-emit by replaying the last-seen `componentDidAppear` event.
- `active-view-context`: New `registerForegroundReEmitter(fn)` registration API.
- `network-instrumentation`: Rename `view.name` → `screen.name` and `view.id` → `screen.id` on enriched fetch/XHR spans.
- `view-correlation`: Same rename, plus updated correlation contract.
- `native-bridge`: Optional `instrumentationName` parameter on `startSpan` / `startClientSpan`. Add Android oldarch `startClientSpan`.
- `error-tracking`: Rename `view.name` → `screen.name` on error spans.
- `user-interactions`: Rename `view.name` → `screen.name` on interaction spans.

## Impact

**Affected packages:**
- `@inox/react-native-edot-sdk` — TurboModule spec, fetch/XHR/errors/interactions enrichment, new `app-state.ts`, defaults, types, native iOS Swift + `.m`, Android `Impl` + oldarch + newarch
- `@inox/react-native-edot-shared` — `ActiveViewContext.registerForegroundReEmitter`
- `@inox/react-native-edot-navigation` — attribute renames, span-name format, foreground re-emit
- `@inox/react-native-edot-expo-router` — same
- `@inox/react-native-edot-wix-navigation` — same, plus last-event replay

**APIs / wire format:**
- Native bridge methods `startSpan` / `startClientSpan` gain an optional 4th argument
- All consumer-facing span attributes change names on the wire (no dual-emit; SDK is unpublished)
- Span name format changes (`"Navigation: X"` → `"X"`)

**Dependencies:** No new runtime dependencies. apm-agent-ios and ElasticOtel-Android versions unchanged.

**Test surface:** All Jest tests asserting `view.*` attributes need updating; new tests for AppState background/foreground transitions and per-plugin foreground re-emit; new TurboModule spec snapshot.

**Documentation:** Root `AGENTS.md`, four package `AGENTS.md`s (`react-native`, `react-native-navigation`, `react-native-expo-router`, `react-native-wix-navigation`), `packages/react-native/ios/AGENTS.md` (note that native iOS lifecycle/AppMetric spans are *not* enriched with `screen.name` — gap deliberately deferred).
