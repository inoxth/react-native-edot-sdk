## Why

Apps that ship the same React Native bundle to both iOS and Android typically want them to surface as **two distinct services** in the Elastic APM service map (e.g. `myapp-ios` and `myapp-android`). Today `EdotConfig.serviceName` is a single top-level required string, so achieving this requires either:

- two separate JS bundles per platform (defeats the point of a shared RN codebase), or
- runtime branching in user code (`Platform.OS === 'ios' ? 'myapp-ios' : 'myapp-android'`), which scatters service-identity logic across consumer apps.

Per-platform service identity is a first-class concept in the underlying native agents — `apm-agent-ios` and `apm-agent-android` each own their own `service.name` resource attribute. The RN SDK is currently the layer that flattens those into one. Allowing the JS config to express the split puts the configuration where developers expect it (the same `initialize(...)` call that already accepts `ios: {...}` / `android: {...}` blocks).

## What Changes

- Add optional `serviceName?: string` to `EdotIosConfig` and `EdotAndroidConfig`. When present, it overrides the top-level `serviceName` on that platform.
- Relax `EdotConfig.serviceName` from required (`string`) to optional (`string | undefined`). The runtime contract — "for the active platform, **either** the top-level value **or** the platform-block override must resolve to a non-empty string with no `,`/`=` characters" — is enforced by `validateConfig`, not by TypeScript.
- Introduce a small private resolver `resolveResourceField(config, field)` shared by `validateConfig` and `mergeConfig`. It returns `config[Platform.OS]?.[field] ?? config[field]`. The resolver is generic over `'serviceName' | 'serviceVersion' | 'deploymentEnvironment'` so the same mechanism can be extended to the other two resource-identity fields later without churn.
- Update `mergeConfig` to call the resolver explicitly for `serviceName`, removing reliance on platform-block spread order to overwrite the top-level value. Native bridge payload remains a flat dict with one `serviceName` key — **no native code changes** on iOS or Android.
- Sharpen the missing-`serviceName` error message to mention the platform fallback: `[EDOT] serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)`.
- Document the per-platform override pattern in `packages/react-native/AGENTS.md` and the per-platform sourcemap upload pattern in `packages/cli/AGENTS.md` (CLI itself is unchanged — devs invoke `upload-sourcemap` once per platform with the appropriate `--service-name`).

Scope is intentionally limited to `serviceName`. `serviceVersion` and `deploymentEnvironment` stay top-level only for now; they can be added later via the same resolver in a one-line change to each platform interface.

iOS pre-init coupling (`EdotReactNativeAgent.preInitialize` from AppDelegate) is unchanged — `preInitialize` is iOS-only by definition, so the AppDelegate dev hardcodes the iOS-side name there. The same pre-init / JS-init coupling that already exists for the other resource-identity fields applies here: when both paths run, the values must agree because the native agent does not restart on JS init when pre-initialized.

Backwards compatibility: this is a **strict superset** — every config valid before this change remains valid. The TypeScript type for `serviceName` becomes weaker (optional instead of required), but every existing call site already supplies it, so no consumer code breaks.

## Capabilities

### Modified Capabilities

- `sdk-initialization`: the config interface, validation rules, and platform-config-forwarding requirements gain support for `serviceName` resolution from the active platform's block before falling back to the top level.

## Impact

**Affected packages:**
- `@inox/react-native-edot-sdk` — `types.ts` (interface change), `config.ts` (resolver + sharpened validation), `EdotReactNative.ts` (`mergeConfig` uses resolver). Tests added under `__tests__/config.test.ts`.
- `@inox/react-native-edot-cli` — no code change. Documentation note added.

**Public API:**
- `EdotConfig.serviceName` — type changes from `string` to `string | undefined`.
- `EdotIosConfig.serviceName?` (new optional field).
- `EdotAndroidConfig.serviceName?` (new optional field).

**Wire format:** unchanged. Native bridge payload still carries one flat `serviceName` per `initialize(...)` call. iOS Swift code at `EdotReactNative.swift:306` and Android Kotlin code at `EdotReactNativeModuleImpl.kt:119` need no modification.

**Native pre-initialization (`EdotReactNativeAgent.preInitialize`):** unchanged. Already iOS-only / Android-only by definition. Documentation will note that the value passed there must match what the JS config resolves to for the corresponding platform.

**Test surface:** ~6 new test cases in `config.test.ts` covering active-platform resolution, both-empty failure, character-restriction check on the resolved value, and the override winning over the top-level value. No existing tests need to change semantically — current `serviceName: 'test-app'` style configs remain valid.

**Documentation:** short additions to `packages/react-native/AGENTS.md` (initialization section) and `packages/cli/AGENTS.md` (sourcemap upload section).
