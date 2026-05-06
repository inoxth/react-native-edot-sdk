## Why

Running `tsc --noEmit` from inside any of the four example apps surfaced 6–10 errors per app, all coming from SDK source files reached via the example's path mapping (`@inox/react-native-edot-sdk → ../../packages/react-native/src/`). Two distinct root causes:

1. **Ambient SDK globals don't load via path mapping.** The SDK declares `global`, `requestIdleCallback`, `cancelIdleCallback`, and `ErrorUtilsLike` in `packages/react-native/src/globals.d.ts`. These load automatically under the SDK's own `tsconfig.json` (which has `"include": ["src"]`), but examples that traverse SDK source via path mapping never see this file — their tsconfig only covers `src/` of the example itself. Result: `errors.ts`, `fetch.ts`, `traceContext.ts`, `startup.ts` all fail with `Cannot find name 'global'` / `Cannot find name 'requestIdleCallback'`.

2. **Example tsconfigs use a narrower `types` set than the SDK.** `@react-native/typescript-config` (extended by basic / react-navigation / wix-navigation) sets `"types": ["jest"]`. The SDK's own tsconfig sets `"types": ["react-native", "jest"]`. Without `"react-native"` in the list, even loading `globals.d.ts` doesn't unblock everything because some indirect type lookups need RN's bundled types.

3. **`global.fetch` signature mismatch under expo's tsconfig.** `expo/tsconfig.base` types the global `fetch` as accepting `URL | RequestInfo`, while our wrapper signature was just `RequestInfo`. The assignment `global.fetch = ...` failed under expo-router with TS2322.

These don't affect runtime — examples build and run fine via Metro. They affect the dev-experience flow of "open an example folder in VSCode and have a clean type-check from there", which is the natural workflow for someone iterating on an example or copy-pasting a working init from one.

## What Changes

- **`packages/react-native/src/index.ts`** — adds `/// <reference path="./globals.d.ts" />` so any consumer of the SDK (whether via path mapping into source, or via `lib/typescript/`) transitively pulls the ambient global declarations. Triple-slash is the appropriate form here because `globals.d.ts` is a script-form declaration file, not a module — `import './globals'` would only load the augmentations for files transitively reached via that import, missing ambient-global needs in test files. An oxlint inline disable explains the rationale.

- **`packages/react-native/src/instrumentation/urlUtils.ts`** — `extractUrl` and `extractMethod` widen their `input` parameter from `RequestInfo` to `URL | RequestInfo`. URL is converted via `.toString()` in `extractUrl`; the `instanceof URL` guard in `extractMethod` distinguishes URL from `Request` for the `'method' in input` branch.

- **`packages/react-native/src/instrumentation/fetch.ts`** — the wrapper signature widens to `URL | RequestInfo`. A `forwardInput: RequestInfo` is computed once at the top (URL → string), and used for the two `originalFetch(...)` calls. The wider type matches modern `fetch(...)` callers (including those who pass a `new URL(...)`); the narrower forwarded value is what RN's `originalFetch` types accept.

- **Three example `tsconfig.json` files** (`basic`, `react-navigation`, `wix-navigation`) — add `"types": ["react-native", "jest"]` to override `@react-native/typescript-config`'s narrower `["jest"]`. Expo-router uses `expo/tsconfig.base` which already includes RN types transitively, so its tsconfig is unchanged.

No public API or wire format change. The wrapper accepting `URL | RequestInfo` is a strict superset of the previous accepted-input shape — every existing call still type-checks.

## Capabilities

### Modified Capabilities

- `network-instrumentation`: `fetch` wrapper signature widens to accept `URL` as the first argument (in addition to `RequestInfo`). `extractUrl` / `extractMethod` helpers widen accordingly.

## Impact

**Affected code:**
- `packages/react-native/src/index.ts` — one new comment + reference
- `packages/react-native/src/instrumentation/urlUtils.ts` — two function signatures + URL handling branches
- `packages/react-native/src/instrumentation/fetch.ts` — wrapper signature + forwarded-input normalization

**Affected tsconfigs:**
- `example/basic/tsconfig.json`
- `example/react-navigation/tsconfig.json`
- `example/wix-navigation/tsconfig.json`

**Test surface:** unchanged. All 302 tests continue to pass. No new tests are added because the existing fetch/url tests cover string and Request inputs; URL-input is functionally equivalent (extractUrl normalizes both to a string).

**Dev-experience improvement:** `tsc --noEmit` inside any example folder now exits 0 with no errors. Previously: 6–10 errors per example.
