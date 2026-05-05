## 1. Shared lifecycle helper

- [x] 1.1 In `packages/react-native-navigation/src/navigation-tracker.ts`, extract the start/end/active-view/foreground-re-emit machinery into a new exported `createNavigationLifecycle(options)` function returning `{ onScreen(name): void, cleanup(): void }`. Options: `instrumentationName: string`, `getCurrentScreenName: () => string | null`.
- [x] 1.2 Refactor `createEdotNavigationContainerRef` to consume `createNavigationLifecycle` for its lifecycle (no behaviour change).
- [x] 1.3 Export `createNavigationLifecycle` and its types from `packages/react-native-navigation/src/index.ts`.
- [x] 1.4 Run `yarn test packages/react-native-navigation` and confirm all existing tests pass.

## 2. Expo-router provider rewrite

- [x] 2.1 Add `@inox/react-native-edot-navigation: "workspace:*"` to `dependencies` in `packages/react-native-expo-router/package.json`.
- [x] 2.2 Replace `packages/react-native-expo-router/src/types.ts` exports: add `ExpoNavigationContainerRef` (with `addListener('state', cb)` and `getCurrentRoute()`), update `EdotExpoNavigationProviderProps` to `{ navigationRef: ExpoNavigationContainerRef; screenNameMapper?: (routeName: string, params?: object) => string; children?: React.ReactNode }`.
- [x] 2.3 Rewrite `packages/react-native-expo-router/src/expo-navigation-provider.tsx`: drop the `usePathname()` resolver, mount/unmount-aware `useEffect` that creates a `createNavigationLifecycle` instance, registers `state` listener on `navigationRef`, calls `lifecycle.onScreen(...)` from initial-emit + listener, returns cleanup that unsubscribes and calls `lifecycle.cleanup()`. Use a ref to capture the latest `screenNameMapper` so it can change between renders without re-creating the lifecycle.
- [x] 2.4 Run `yarn build` (workspace) so `lib/typescript` for `@inox/react-native-edot-navigation` exposes the new exports.
- [x] 2.5 Run `yarn typecheck` from the expo-router package and confirm no errors.

## 3. Tests

- [x] 3.1 Rewrite `packages/react-native-expo-router/src/__tests__/expo-navigation-provider.test.tsx` with a fake `navigationRef` (in-test factory exposing `addListener`/`getCurrentRoute` plus helpers `setRoute`/`emitState`).
- [x] 3.2 Cover scenarios: initial emit on mount, no-op when initial route is undefined, delayed initial route via `state` event, state-change emit with `last.screen.name`, mapper application with route params, no re-emit when route name unchanged, foreground re-emit replays current route without `last.screen.name`, unmount ends span + clears context + unsubscribes listener, unmount unregisters foreground re-emitter.
- [x] 3.3 Run `yarn test packages/react-native-expo-router` and confirm all tests pass.

## 4. Example app

- [x] 4.1 Update `example/expo-router/app/_layout.tsx`: import `useNavigationContainerRef` from `expo-router`, pass `navigationRef` to `<EdotExpoNavigationProvider>`, change the `screenNameMapper` signature from `(pathname: string)` to `(routeName: string)`.
- [x] 4.2 Run `yarn typecheck` in `example/expo-router` (pre-existing errors unrelated to this change are tolerated).

## 5. Spec & docs

- [x] 5.1 Write `openspec/changes/2026-05-05-expo-router-route-name-tracking/proposal.md` describing the rationale (URL-shaped names dropped by APM Server, strict-mode guard bug, alignment with the react-navigation plugin's existing approach).
- [x] 5.2 Write `openspec/changes/2026-05-05-expo-router-route-name-tracking/specs/expo-router-plugin/spec.md` with MODIFIED requirements (provider, span creation, ActiveViewContext integration, foreground re-emit, cleanup) and REMOVED requirement (usePathname-based detection).
- [x] 5.3 Update `packages/react-native-expo-router/AGENTS.md` to reflect the new usage pattern (use `useNavigationContainerRef`, route-name-based mapping).

## 6. Final verification

- [x] 6.1 Run `yarn test`, `yarn lint`, `yarn typecheck` from repo root. All green.
- [x] 6.2 Manual verification on device: install the updated example, navigate Home → Demos → Network → back → Settings → Home, confirm all five route names appear in APM with no drops.
