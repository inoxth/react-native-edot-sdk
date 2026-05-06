## 1. Type changes

- [x] 1.1 In `packages/react-native/src/types.ts`, change `EdotConfig.serviceName` from `serviceName: string;` to `serviceName?: string;`.
- [x] 1.2 Add `serviceName?: string;` to `EdotIosConfig` (above the existing iOS toggles) in `packages/react-native/src/types.ts`.
- [x] 1.3 Add `serviceName?: string;` to `EdotAndroidConfig` (above `diskBufferingEnabled`) in `packages/react-native/src/types.ts`.

## 2. Resolver + validation

- [x] 2.1 In `packages/react-native/src/config.ts`, add a private function `resolveResourceField(config: EdotConfig, field: 'serviceName' | 'serviceVersion' | 'deploymentEnvironment'): string | undefined`. It SHALL read `Platform.OS` from `react-native`, look up the matching platform block (`config.ios` or `config.android`), and return `platformBlock?.[field] ?? config[field]`.
- [x] 2.2 In `validateConfig`, replace the `serviceName` branch of the required-fields loop with a check on the resolved value. Throw `[EDOT] serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)` when missing on the active platform.
- [x] 2.3 In `validateConfig`, replace the `serviceName` branch of the resource-identity-character loop with a check on the resolved value. Reuse the existing error message wording for the `,`/`=` rejection but with the resolved value in the JSON-stringified output.
- [x] 2.4 Other required-fields (`serverUrl`, `serviceVersion`, `deploymentEnvironment`) and other resource-identity-character checks continue to read the top-level value directly — unchanged.

## 3. mergeConfig

- [x] 3.1 In `packages/react-native/src/EdotReactNative.ts`, import `resolveResourceField` from `./config` (export it from `config.ts` first if not already exported as `internal`).
- [x] 3.2 In `mergeConfig`, replace `serviceName: config.serviceName,` with `serviceName: resolveResourceField(config, 'serviceName') ?? '',`. (Empty string is unreachable because `validateConfig` runs first; the `??` is a TypeScript narrowing aid.)
- [x] 3.3 Strip `serviceName` from the platform-block spread before applying it, so the bridge payload never carries duplicate or stale values. Implementation hint: build `const { serviceName: _, ...platformExtras } = platformConfig ?? {};` then spread `...platformExtras` instead of `...platformConfig`.
- [x] 3.4 The internal `InternalConfig` type's `serviceName: string;` field is unchanged.

## 4. Tests

- [x] 4.1 In `packages/react-native/src/__tests__/config.test.ts`, add `it('accepts ios.serviceName when top-level serviceName is missing on iOS', ...)` — mock `Platform.OS = 'ios'`, pass `{ ios: { serviceName: 'myapp-ios' } }` (drop top-level), expect no throw.
- [x] 4.2 Add `it('throws when neither top-level nor active-platform serviceName resolves', ...)` — mock `Platform.OS = 'android'`, pass `{ ios: { serviceName: 'myapp-ios' } }` (no Android override, no top-level), expect throw with message including `set top-level serviceName or ios.serviceName / android.serviceName`.
- [x] 4.3 Add `it('platform-block serviceName overrides top-level', ...)` — assert the resolver returns the platform value when both are present (verify via observed bridge payload or a re-exported resolver if appropriate).
- [x] 4.4 Add `it('rejects platform-block serviceName containing , or =', ...)` — pass `{ ios: { serviceName: 'foo,bar' } }`, expect throw mentioning `,` or `=` rejection.
- [x] 4.5 Add `it('throws when active-platform serviceName is empty even if top-level is missing', ...)` — pass `{ ios: { serviceName: '' } }` on iOS, expect required-field throw.
- [x] 4.6 Existing tests continue to pass without modification (every existing test config provides `serviceName: 'test'` or similar at the top level).

## 5. Documentation

- [x] 5.1 In `packages/react-native/AGENTS.md`, add a short subsection under "Initialization Flow" titled "Per-platform service identity" describing the override semantics, with an inline TypeScript example.
- [x] 5.2 In `packages/cli/AGENTS.md`, add a paragraph under the upload-sourcemap section noting that when SDK config splits service names, devs must invoke `upload-sourcemap` once per platform with the matching `--service-name`.
- [x] 5.3 In `packages/react-native/README.md`, update the Configuration tables:
  - In the "Required" table (lines 81–86), update the `serviceName` row to note it can also be supplied per-platform via `ios.serviceName` / `android.serviceName`, and clarify that one of the two paths must resolve.
  - Add a `ios.serviceName` row to the "iOS-only" table (lines 137–148): "Override `serviceName` on iOS. Falls back to top-level `serviceName` when omitted."
  - Add a `android.serviceName` row to the "Android-only" table (lines 149–154) with the matching description for Android.
  - Add a short example block under the Initialize section (after line 73) showing `{ ios: { serviceName: 'myapp-ios' }, android: { serviceName: 'myapp-android' } }`.

## 6. Verification

- [x] 6.1 `yarn typecheck` from repo root — green.
- [x] 6.2 `yarn lint` — green (oxlint).
- [x] 6.3 `yarn fmt` — clean.
- [x] 6.4 `yarn test packages/react-native` — all suites pass, including the 5 new cases.
- [x] 6.5 Manual smoke check on the `example/basic` app: set `ios.serviceName: 'edot-basic-ios'` in the example's init call, run on iOS, confirm the APM UI shows the new service name.
