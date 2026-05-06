## 1. Tracer scope unification

- [x] 1.1 Change `INSTRUMENTATION_NAME` in `packages/react-native-navigation/src/wix-listener.ts:8` from `'@inox/react-native-edot-wix-navigation'` to `'@inox/react-native-edot-navigation'`.
- [x] 1.2 Update all four `'@inox/react-native-edot-wix-navigation'` assertions in `packages/react-native-navigation/src/__tests__/wix-listener.test.ts` to the unified scope.

## 2. Documentation sync

- [x] 2.1 Update `packages/react-native-navigation/AGENTS.md` "Span Shape" section: tracer scope is now a single value, not a per-surface bullet list.
- [x] 2.2 Update `AGENTS.md` (root) "Navigation Plugin Pattern" Wix bullet to use the unified scope with a one-line rationale.
- [x] 2.3 Update `packages/react-native/AGENTS.md` per-callsite scope table: Wix row uses the unified scope.

## 3. Spec sync — navigation-tracking

- [x] 3.1 In `openspec/specs/navigation-tracking/spec.md`, rename "Per-surface tracer scope" requirement to "Tracer scope". Mandate a single `@inox/react-native-edot-navigation` value. Update both scenarios (component span scope, Wix listener span scope) to assert the same value.

## 4. Spec sync — example-react-navigation

- [x] 4.1 Replace `view.name` / `view.previous` / `view.transition_type` with `screen.name` / `last.screen.name` across all scenarios.
- [x] 4.2 Replace `createEdotNavigationContainerRef()` with `<EdotNavigationProvider navigationRef={...}>` (post-unify API).
- [x] 4.3 Replace "view spans" with "screen-lifetime spans".
- [x] 4.4 Add an `instrumentation.scope.name = "@inox/react-native-edot-navigation"` assertion on the stack-push scenario.

## 5. Spec sync — example-expo-router

- [x] 5.1 Replace `view.name` / `view.previous` / `view.url` with `screen.name` / `last.screen.name` across all scenarios.
- [x] 5.2 Reference `<EdotNavigationProvider>` (post-unify API; previously was `<EdotExpoNavigationProvider>` then ambiguous).
- [x] 5.3 Replace "view spans" with "screen-lifetime spans".
- [x] 5.4 Add an `instrumentation.scope.name = "@inox/react-native-edot-navigation"` assertion on the stack-push scenario.

## 6. Spec sync — example-wix-navigation

- [x] 6.1 Replace `view.name` / `view.previous` with `screen.name` / `last.screen.name` across all scenarios.
- [x] 6.2 Replace "view spans" with "screen-lifetime spans".
- [x] 6.3 Add an `instrumentation.scope.name = "@inox/react-native-edot-navigation"` assertion on the stack-push scenario.
- [x] 6.4 Note in the integration requirement that `registerEdotNavigationListener` is called inside `Navigation.events().registerAppLaunchedListener` so it is wired before `Navigation.setRoot`.

## 7. Verification

- [x] 7.1 `yarn typecheck` — green.
- [x] 7.2 `yarn lint` — green.
- [x] 7.3 `yarn fmt` — clean.
- [x] 7.4 `yarn test` — all 302 tests pass (4 wix-listener assertions updated).
- [x] 7.5 `grep -r '@inox/react-native-edot-wix-navigation' src/` returns no results (modulo gitignored build artifacts under `lib/` and the archived unify-navigation-package change).
