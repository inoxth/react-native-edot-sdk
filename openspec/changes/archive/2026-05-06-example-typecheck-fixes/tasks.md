## 1. SDK source — ambient globals reachable through path mapping

- [x] 1.1 Add `/// <reference path="./globals.d.ts" />` (with an `oxlint-disable-next-line typescript/triple-slash-reference` comment + rationale) at the top of `packages/react-native/src/index.ts`. Triple-slash is required because `globals.d.ts` is script-form (declares ambient names without `export {}`), so a side-effect `import './globals'` would only augment files in its module subtree.

## 2. SDK source — fetch wrapper accepts URL

- [x] 2.1 In `packages/react-native/src/instrumentation/urlUtils.ts`, widen `extractUrl(input)` from `RequestInfo` to `URL | RequestInfo`. Convert URL via `.toString()`.
- [x] 2.2 In `packages/react-native/src/instrumentation/urlUtils.ts`, widen `extractMethod(input, init?)` similarly. Add `!(input instanceof URL)` guard before the `'method' in input` branch.
- [x] 2.3 In `packages/react-native/src/instrumentation/fetch.ts`, widen the wrapper's `input` parameter to `URL | RequestInfo`. Compute `forwardInput: RequestInfo = input instanceof URL ? input.toString() : input` once at the top. Replace `originalFetch(input, ...)` with `originalFetch(forwardInput, ...)` in both the early-return ignore branch and the main branch.

## 3. Example tsconfigs — provide RN types to SDK source via path mapping

- [x] 3.1 In `example/basic/tsconfig.json`, add `"types": ["react-native", "jest"]` under `compilerOptions` (overrides `@react-native/typescript-config`'s `["jest"]`).
- [x] 3.2 Same in `example/react-navigation/tsconfig.json`.
- [x] 3.3 Same in `example/wix-navigation/tsconfig.json`.
- [x] 3.4 `example/expo-router/tsconfig.json` — no change needed; it extends `expo/tsconfig.base` which already brings RN types in.

## 4. Verification

- [x] 4.1 `yarn typecheck` from repo root — green.
- [x] 4.2 `yarn lint` — 0 warnings, 0 errors (the oxlint disable on the triple-slash silences the rule).
- [x] 4.3 `yarn fmt` — clean.
- [x] 4.4 `yarn test` — 302 tests pass, 28 suites.
- [x] 4.5 `yarn tsc --noEmit` from inside each of `example/{basic,react-navigation,wix-navigation,expo-router}/` — exits 0 with 0 errors.
