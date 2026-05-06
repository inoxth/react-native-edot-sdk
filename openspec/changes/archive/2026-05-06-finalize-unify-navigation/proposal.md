## Why

Two leftover items from the [unify-navigation-package](../archive/2026-05-05-unify-navigation-package/) change were missed:

1. **Two distinct OpenTelemetry tracer scope names** were preserved across the merged package: `@inox/react-native-edot-navigation` for the ref-based provider and `@inox/react-native-edot-wix-navigation` for the Wix listener. This was originally a deliberate continuity choice (existing dashboards / queries keyed on the old scope name), but the repo is pre-publish (`private: true`, `0.0.0`) — there are no external consumers whose dashboards would break, so the second scope is now unjustified surface area and a confusing artifact: it names a package that no longer exists.

2. **Three example specs (`example-react-navigation`, `example-expo-router`, `example-wix-navigation`) still describe legacy `view.*` attributes** (`view.name`, `view.previous`, `view.url`, `view.transition_type`) and stale APIs (`createEdotNavigationContainerRef()`, "view spans" terminology). These contradict the post-[align-navigation-with-elastic-mobile-spec](../archive/2026-05-04-align-navigation-with-elastic-mobile-spec/) span shape that emits `screen.name` / `last.screen.name` and produces "screen-lifetime spans". The example specs should have been updated alongside the unify-navigation change but weren't.

Both items fall out of unify-navigation's commit, are small, and are best handled together so the navigation-tracking surface is fully internally consistent.

## What Changes

- **Tracer scope unification.** `registerEdotNavigationListener` (Wix listener) now uses `instrumentationName = "@inox/react-native-edot-navigation"` — the same scope as `<EdotNavigationProvider>`. The unified package owns one OTel scope. The `INSTRUMENTATION_NAME` constant in `packages/react-native-navigation/src/wix-listener.ts:8` is changed from the per-surface string. Eight test assertions in `wix-listener.test.ts` are updated to assert the unified scope. Documentation in three `AGENTS.md` files (root, react-native, react-native-navigation) updated to reflect the single-scope model.

- **Navigation-tracking spec refactor.** The "Per-surface tracer scope" requirement in `openspec/specs/navigation-tracking/spec.md` is renamed to "Tracer scope" and now mandates a single scope. Both scenarios (component span scope, Wix listener span scope) assert the same value.

- **Example specs synced to post-unify span shape.** All three navigation example specs (`example-react-navigation`, `example-expo-router`, `example-wix-navigation`) replace legacy `view.name` / `view.previous` / `view.url` / `view.transition_type` with `screen.name` / `last.screen.name`, replace "view spans" with "screen-lifetime spans", and reference the current public API surface (`<EdotNavigationProvider>` instead of `createEdotNavigationContainerRef()`). Each example spec also now asserts the unified `instrumentation.scope.name` value.

No code change beyond what's described above. No native code changes. No public API surface changes (the provider component, the Wix listener function, and their props/options are identical to before).

## Capabilities

### Modified Capabilities

- `navigation-tracking`: tracer scope requirement collapses from per-surface to single-scope.
- `example-react-navigation`, `example-expo-router`, `example-wix-navigation`: scenarios use `screen.*` attributes, current API names, and the unified scope.

## Impact

**Affected code:**
- `packages/react-native-navigation/src/wix-listener.ts` — one constant change
- `packages/react-native-navigation/src/__tests__/wix-listener.test.ts` — 4 assertion updates

**Affected docs:**
- `AGENTS.md` (root) — Wix bullet under "Navigation Plugin Pattern"
- `packages/react-native/AGENTS.md` — per-callsite scope table
- `packages/react-native-navigation/AGENTS.md` — Span Shape section

**Affected specs:**
- `openspec/specs/navigation-tracking/spec.md`
- `openspec/specs/example-react-navigation/spec.md`
- `openspec/specs/example-expo-router/spec.md`
- `openspec/specs/example-wix-navigation/spec.md`

**Wire format:** `instrumentation.scope.name` on Wix navigation spans changes from `"@inox/react-native-edot-wix-navigation"` to `"@inox/react-native-edot-navigation"`. Pre-publish, no external dashboards depend on the old value. After this change, filtering Wix-only spans is done by span name patterns (Wix uses component names, ref-based uses route names) or by other span attributes — not by `instrumentation.scope.name`.

**Test surface:** unchanged count, 4 assertion strings updated. All 302 tests continue to pass.
