## 1. Refactor navigation package layout

- [x] 1.1 Rename `packages/react-native-navigation/src/navigation-tracker.ts` → `navigation-lifecycle.ts`. Keep only `createNavigationLifecycle`. Drop `createEdotNavigationContainerRef` and `resetForTesting`.
- [x] 1.2 Add `packages/react-native-navigation/src/navigation-provider.tsx` with `<EdotNavigationProvider navigationRef={...} screenNameMapper={...}>`. Subscribe to `addListener('state', ...)`, emit current route via `getCurrentRoute()`. Capture `screenNameMapper` in a ref so the lifecycle is not recreated on each render.
- [x] 1.3 Add `packages/react-native-navigation/src/wix-listener.ts` with `registerEdotNavigationListener(Navigation, options?)`. Hook `Navigation.events().registerComponentDidAppearListener(...)`. Stash last event for foreground re-emit.
- [x] 1.4 Update `packages/react-native-navigation/src/types.ts` to add `NavigationContainerRefLike`, `WixNavigationLike`, `WixComponentDidAppearEvent`, mapper types.
- [x] 1.5 Update `packages/react-native-navigation/src/index.ts` to export the new public surface.

## 2. Update package metadata

- [x] 2.1 Add `@react-navigation/native`, `expo-router`, `react-native-navigation` as optional peer dependencies via `peerDependenciesMeta` in `packages/react-native-navigation/package.json`.
- [x] 2.2 Drop `@react-navigation/native` from `devDependencies` (no longer imported anywhere).
- [x] 2.3 Update root `tsconfig.json` `references[]` to drop the two deleted packages.

## 3. Delete the two old packages

- [x] 3.1 Delete `packages/react-native-expo-router/` directory.
- [x] 3.2 Delete `packages/react-native-wix-navigation/` directory.

## 4. Tests

- [x] 4.1 Replace `packages/react-native-navigation/src/__tests__/navigation-tracker.test.ts` with three files: `navigation-lifecycle.test.ts`, `navigation-provider.test.tsx`, `wix-listener.test.ts`.
- [x] 4.2 Update `packages/react-native-navigation/jest.config.js` to map `react` and `react-test-renderer` to repo-root paths (avoids dual-React error in component tests). Allow `@testing-library` in `transformIgnorePatterns`.
- [x] 4.3 Run `yarn test packages/react-native-navigation`. All 25 tests pass.

## 5. Migrate example apps

- [x] 5.1 `example/expo-router/package.json`: change dep from `@inox/react-native-edot-expo-router` → `@inox/react-native-edot-navigation`.
- [x] 5.2 `example/expo-router/app/_layout.tsx`: change import + rename `EdotExpoNavigationProvider` → `EdotNavigationProvider`.
- [x] 5.3 `example/wix-navigation/package.json`: change dep from `@inox/react-native-edot-wix-navigation` → `@inox/react-native-edot-navigation`.
- [x] 5.4 `example/wix-navigation/index.js`: change import path.
- [x] 5.5 `example/react-navigation/src/App.tsx`: switch from `createEdotNavigationContainerRef()` + manual `onReady`/`onStateChange` wiring to `useNavigationContainerRef()` + `<EdotNavigationProvider>` wrapper.

## 6. Documentation

- [x] 6.1 Rewrite `packages/react-native-navigation/AGENTS.md` to document the unified package surface (component + listener + lifecycle helper, all three navigator usage patterns).
- [x] 6.2 The two deleted packages' AGENTS.md / README files are removed with their directories.

## 7. Verification

- [x] 7.1 `yarn install` succeeds (workspace resolution clean).
- [x] 7.2 `yarn typecheck` from repo root — green.
- [x] 7.3 `yarn lint` — green.
- [x] 7.4 `yarn test` — all suites pass.
- [ ] 7.5 Manual on-device verification on each of the three example apps — navigation transactions land in APM as before.
