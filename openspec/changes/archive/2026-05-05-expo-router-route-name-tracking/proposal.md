## Why

The current `EdotExpoNavigationProvider` uses `usePathname()` from `expo-router` and emits the raw URL path (`/`, `/demos`, `/demos/network`, `/demos/errors`) as the screen-lifetime span name. Manual testing against Elastic APM Server reveals two real problems with this design:

1. **APM Server silently drops some URL-shaped transactions.** Spans created by the SDK arrive in the iOS native bridge (verified via Xcode console) but never appear in the APM transaction list — for example `/demos/network` is consistently missing while sibling paths under `/demos/*` survive. Renaming `/demos/network` to `NetworkScreen` in the example's `screenNameMapper` immediately makes it land. URL-style names interact poorly with APM Server's transaction grouping/classification heuristics, in ways the SDK has no visibility into and cannot fix from the client.
2. **The `usePathname()`-driven lifecycle has a strict-mode hazard.** The current effect compares `previousScreenNameRef.current !== displayName` before starting a span. In React 18 strict mode (default in dev), the effect runs → cleanup → re-runs. After the first cycle, `prev === display`, so the second run does **not** restart the span; the initial `/` span ends after microseconds and is never replaced. This causes occasional "missing initial screen" reports.

Because `expo-router` is built on top of `@react-navigation/native`, the same `useNavigationContainerRef()` hook and `getCurrentRoute().name` access pattern that powers our `react-native-navigation` plugin works for `expo-router` too. That path produces identifier-style span names (`index`, `network`, `(tabs)`) instead of URL paths, and our `react-native-navigation` plugin already emits those names successfully against APM. The expo-router plugin is the outlier — it is the only one driving span names from URLs.

## What Changes

- **BREAKING** Replace the `usePathname()` integration in `@inox/react-native-edot-expo-router` with a `useNavigationContainerRef()`-based integration. The provider now requires a `navigationRef` prop obtained from `expo-router`'s `useNavigationContainerRef()` hook and reads the current route via `navigationRef.getCurrentRoute()`.
- **BREAKING** `screenNameMapper` signature changes from `(pathname: string) => string` to `(routeName: string, params?: object) => string` to match the react-navigation plugin and reflect the new input.
- Span names now equal the expo-router route segment name (e.g. `index`, `demos`, `network`, `(tabs)`) after `screenNameMapper`, not the URL pathname.
- Extract a shared `createNavigationLifecycle` helper in `@inox/react-native-edot-navigation` that owns the start/end/active-view/foreground-re-emit logic. Both plugins now build on the same lifecycle code, eliminating the strict-mode guard bug specific to the expo-router provider.
- Drop the redundant `prev !== display` guard from the expo-router provider. The lifecycle's internal `onScreen(name)` already deduplicates by comparing against the previous emitted screen name.
- Public name `EdotExpoNavigationProvider` and the `EdotExpoNavigationProviderProps` type are retained — only the props shape changes.

Per repo policy, no backwards-compatibility shim is added. Consumers must update their `_layout.tsx` to (a) call `useNavigationContainerRef()`, (b) pass it as the `navigationRef` prop, and (c) update the `screenNameMapper` signature if they had one.

## Capabilities

### Modified Capabilities

- `expo-router-plugin`: Plugin behaviour rewritten — span name source switches from `usePathname()` to `getCurrentRoute().name`, `screenNameMapper` signature changes, `navigationRef` becomes a required prop, foreground re-emit reads from the navigationRef instead of a stashed pathname ref.

### New Capabilities

- `navigation-lifecycle`: Library-agnostic lifecycle helper exported from `@inox/react-native-edot-navigation` that encapsulates the screen-lifetime span machinery (start, end, active-view, foreground re-emit). Both `react-navigation` and `expo-router` plugins consume it.

## Impact

**Affected packages:**
- `@inox/react-native-edot-expo-router` — provider rewritten, types changed, dependency on `@inox/react-native-edot-navigation` added, tests rewritten
- `@inox/react-native-edot-navigation` — `createNavigationLifecycle` extracted as a public export; existing `createEdotNavigationContainerRef` now consumes it (no behaviour change)

**APIs:**
- `EdotExpoNavigationProviderProps.navigationRef` — new required prop
- `EdotExpoNavigationProviderProps.screenNameMapper` signature change
- `createNavigationLifecycle` — new export from `@inox/react-native-edot-navigation`

**Wire format:** Span names emitted by `EdotExpoNavigationProvider` change from URL paths (`/demos/network`) to route segment names (`network`). Attributes (`screen.name`, `last.screen.name`) and instrumentation name (`@inox/react-native-edot-expo-router`) are unchanged.

**Dependencies:** `@inox/react-native-edot-expo-router` now depends on `@inox/react-native-edot-navigation` (workspace).

**Test surface:** Existing expo-router provider tests rewritten to drive a fake `navigationRef` instead of mocking `usePathname()`. Navigation package tests unchanged (still pass against the refactored implementation).

**Documentation:** `packages/react-native-expo-router/AGENTS.md` (and README if present) updated to show new usage pattern.
