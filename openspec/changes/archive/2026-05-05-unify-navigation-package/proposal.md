## Why

We currently ship three separate npm packages for navigation tracking — one per supported navigator:

- `@inox/react-native-edot-navigation` (react-navigation, ~140 LOC)
- `@inox/react-native-edot-expo-router` (expo-router, ~70 LOC)
- `@inox/react-native-edot-wix-navigation` (Wix, ~60 LOC)

After recent refactors all three share a single `createNavigationLifecycle` helper from the react-navigation package — meaning the lifecycle code is already deduplicated, but the **packaging boundaries** still impose three `package.json`, three build pipelines, three publishes, three changelogs, three sets of consumer install commands. The code-level coupling already proves the surfaces belong together; the package boundaries are now overhead with no benefit.

The repo is pre-publish (`private: true`, `0.0.0`) so consolidating now is cheap and avoids forcing any breaking import paths on external users later.

## What Changes

- **BREAKING** Collapse three packages into one: keep `@inox/react-native-edot-navigation` and delete `@inox/react-native-edot-expo-router` and `@inox/react-native-edot-wix-navigation`.
- **BREAKING** Replace the imperative `createEdotNavigationContainerRef()` (react-navigation) with the new `<EdotNavigationProvider navigationRef={...}>` component. Component pattern matches the expo-router consumer pattern; both navigators now use the same provider. react-navigation example switches from `useRef(createEdotNavigationContainerRef())` to `useNavigationContainerRef()` + provider wrapper.
- **BREAKING** Rename the expo-router export from `EdotExpoNavigationProvider` to `EdotNavigationProvider`. Same prop shape, same usage, new import path: `@inox/react-native-edot-navigation`.
- Wix keeps the imperative `registerEdotNavigationListener(Navigation, options)` function (re-exported from the unified package). Wix's API is genuinely different from the ref-based navigators — Wix has no continuously-mounted React root so a provider component would need brittle HOC patterns. Keeping the imperative listener is honest about that architectural difference.
- Add `@react-navigation/native`, `expo-router`, and `react-native-navigation` as **optional** peer dependencies on the unified package. The package never imports them — props/arguments are duck-typed via local `NavigationContainerRefLike` and `WixNavigationLike` interfaces.
- Move all tests under the unified package; delete the two deleted packages' workspaces from `tsconfig.json` references.

Per repo policy, no backwards-compat shims. Three example apps in this repo update their imports.

## Capabilities

### Modified Capabilities

- `navigation-tracking`: top-level navigation-tracking requirements now describe a single unified package surface (component + Wix listener + lifecycle helper) rather than three separate plugins.

### Removed Capabilities

- `react-navigation-plugin`: replaced by the unified package's `<EdotNavigationProvider>` requirements.
- `expo-router-plugin`: replaced by the unified package's `<EdotNavigationProvider>` requirements (same component handles both ref-based navigators).
- `wix-navigation-plugin`: replaced by the unified package's `registerEdotNavigationListener` requirements.

## Impact

**Affected packages:**
- `@inox/react-native-edot-navigation` — gains `<EdotNavigationProvider>`, gains `registerEdotNavigationListener`, drops `createEdotNavigationContainerRef`
- `@inox/react-native-edot-expo-router` — **deleted**
- `@inox/react-native-edot-wix-navigation` — **deleted**

**Public API:**
- `EdotNavigationProvider` (new) — required navigationRef, optional screenNameMapper
- `registerEdotNavigationListener` (relocated from wix package)
- `createNavigationLifecycle` (still exported for advanced consumers)
- `createEdotNavigationContainerRef` — **removed**

**Wire format:** unchanged. Span names, attributes (`screen.name`, `last.screen.name`), instrumentation names, and tracer scopes are identical to before.

**Dependencies:** consumers must update one import path per app:
- `@inox/react-native-edot-expo-router` → `@inox/react-native-edot-navigation`
- `@inox/react-native-edot-wix-navigation` → `@inox/react-native-edot-navigation`
- react-navigation consumers also switch from imperative ref-callback pattern to provider component (one-time refactor in `App.tsx`).

**Test surface:** test count drops slightly due to dedup; `navigation-lifecycle.test.ts`, `navigation-provider.test.tsx`, `wix-listener.test.ts` cover all paths.

**Documentation:** single `AGENTS.md` for the unified package; the two deleted package-specific files go away with their packages.
