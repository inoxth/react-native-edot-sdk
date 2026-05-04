## 1. TurboModule Spec & JS Wrapper

- [x] 1.1 Add optional `instrumentationName?: string | null` 4th parameter to `startSpan` and `startClientSpan` in `packages/react-native/src/NativeEdotReactNative.ts`
- [x] 1.2 Update `getNativeModule()` wrapper / `EdotNativeModule` proxy in `packages/react-native/src/nativeModule.ts` (and `packages/shared/src/getNativeModule.ts` if applicable) to forward the new argument
- [x] 1.3 Run `yarn typecheck` after spec change to confirm callsites still compile (with default omitted)

## 2. iOS Native Bridge

- [x] 2.1 Update `packages/react-native/ios/EdotReactNative.m` `RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD` declarations for both `startSpan` and `startClientSpan` to include `instrumentationName:(NSString * _Nullable)instrumentationName`
- [x] 2.2 Update `packages/react-native/ios/EdotReactNative.swift`: replace cached `tracer` computed property with `func tracer(named: String?) -> any Tracer` that returns `OpenTelemetry.instance.tracerProvider.get(instrumentationName: named ?? "react-native-edot")`
- [x] 2.3 Update `EdotReactNative.swift` `startSpan(_:attributes:parentSpanId:)` and `startClientSpan(_:attributes:parentSpanId:)` selectors to accept `instrumentationName:` and pass it to `tracer(named:)`
- [x] 2.4 Verify the iOS legacy bridge change works under both Old Architecture and New Architecture (`RCTLegacyInteropModuleProvider` wraps the same `.m`/`.swift` pair) — manual smoke check on `example/basic` *(verified by user on device)*

## 3. Android Native Bridge

- [x] 3.1 Update `packages/react-native/android/src/main/java/com/edot/reactnative/EdotReactNativeModuleImpl.kt`: `startSpan(...)` and `startClientSpan(...)` accept `instrumentationName: String?` and call `OpenTelemetry.get().getTracer(instrumentationName ?: "react-native-edot")`
- [x] 3.2 Update `packages/react-native/android/src/oldarch/java/com/edot/reactnative/EdotReactNativeModule.kt` `@ReactMethod(isBlockingSynchronousMethod = true) fun startSpan(name, attributes, parentSpanId, instrumentationName)` to plumb the new parameter
- [x] 3.3 Add the missing `@ReactMethod(isBlockingSynchronousMethod = true) fun startClientSpan(name, attributes, parentSpanId, instrumentationName)` declaration to the old-arch module (parity with iOS legacy bridge)
- [x] 3.4 Update `packages/react-native/android/src/newarch/java/com/edot/reactnative/EdotReactNativeModule.kt` `override fun startSpan(...)` and `override fun startClientSpan(...)` after codegen regeneration; ensure both match the new spec
- [x] 3.5 Run `yarn build` and verify Android codegen artifacts compile clean *(covered by 12.5; verified again via user manual test on Android)*

## 4. Shared Package — `ActiveViewContext` foreground re-emitter API

- [x] 4.1 In `packages/shared/src/ActiveViewContext.ts` (or equivalent file) add `registerForegroundReEmitter(fn: () => void): () => void` returning an idempotent unregister function
- [x] 4.2 Add `notifyForegroundReEmitters(): void` (internal) that iterates re-emitters in registration order, swallowing per-callback exceptions but allowing remaining callbacks to run
- [x] 4.3 Extend `_resetForTesting()` in shared to clear the re-emitter registry
- [x] 4.4 Add Jest tests covering: register, unregister, idempotent unregister, multi-plugin registration, exception isolation, reset clears registry

## 5. SDK — App-State Tracking

- [x] 5.1 Create `packages/react-native/src/instrumentation/app-state.ts` with `setupAppStateTracking(): () => void`. Listen for `AppState.addEventListener('change', ...)`. Maintain a module-local `wasBackgrounded` boolean. On `'background'`: end active span via `EdotNativeModule.endSpan(spanId, 1)`, clear context, set `wasBackgrounded = true`. On `'inactive'`: no-op. On `'active'` when `wasBackgrounded`: invoke `ActiveViewContext.notifyForegroundReEmitters()`, then set `wasBackgrounded = false`.
- [x] 5.2 Add `appStateTracking: true` to `EDOT_DEFAULTS` in `packages/react-native/src/defaults.ts`
- [x] 5.3 Add `appStateTracking?: boolean` to the `Instrumentation` config type in `packages/react-native/src/types.ts`
- [x] 5.4 Wire `setupAppStateTracking()` into `EdotReactNative.initialize()` in `packages/react-native/src/EdotReactNative.ts` behind the merged `appStateTracking` toggle; store its teardown in `teardowns[]`
- [x] 5.5 Add Jest tests for `app-state.ts`: background ends span, inactive is no-op, active-after-background re-emits, active-without-prior-background does not re-emit, sequence `inactive → background → inactive → active` re-emits exactly once

## 6. Navigation Plugin — react-navigation

- [x] 6.1 In `packages/react-native-navigation/src/navigation-tracker.ts` rename attribute keys: `view.name` → `screen.name`, `view.previous` → `last.screen.name`. Remove `view.transition_type` entirely.
- [x] 6.2 Change span name from `"Navigation: ${screenName}"` to `screenName` (plain)
- [x] 6.3 Pass `instrumentationName: "@inox/react-native-edot-navigation"` to `getNativeModule().startSpan(...)`
- [x] 6.4 Enforce `last.screen.name` only-when-prior-and-different semantics (omit on first emission and on foreground re-emit)
- [x] 6.5 Register a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` inside `createEdotNavigationContainerRef(...)`. The re-emitter resets `previousScreenName = null`, then reads `navigationRef.current?.getCurrentRoute()`, then calls `startViewSpan(...)`.
- [x] 6.6 Update `cleanup()` to call the unregister function returned in 6.5 in addition to ending the active span and clearing context
- [x] 6.7 Update `packages/react-native-navigation/src/__tests__/navigation-tracker.test.ts`: rename attribute assertions, drop `view.transition_type` assertions, add foreground re-emit tests, add `instrumentationName` assertion

## 7. Navigation Plugin — expo-router

- [x] 7.1 In `packages/react-native-expo-router/src/expo-navigation-provider.tsx` rename attribute keys: `view.name` → `screen.name`, `view.previous` → `last.screen.name`. Remove `view.transition_type` and `view.url` (the pathname is the span name).
- [x] 7.2 Change span name from `"Navigation: ${displayName}"` to plain `displayName`
- [x] 7.3 Pass `instrumentationName: "@inox/react-native-edot-expo-router"` to the native span call
- [x] 7.4 Stash latest pathname in a ref (already partially present) so it is available to the foreground re-emitter
- [x] 7.5 Register a foreground re-emitter inside the provider's `useEffect` mount path. Reset `previousPathnameRef.current = null`, then re-run the same span-creation effect path using the stashed pathname.
- [x] 7.6 Unmount cleanup calls the unregister function returned in 7.5
- [x] 7.7 Update `packages/react-native-expo-router/src/__tests__/expo-navigation-provider.test.tsx`: rename assertions, add foreground re-emit tests, add `instrumentationName` assertion

## 8. Navigation Plugin — wix-navigation

- [x] 8.1 In `packages/react-native-wix-navigation/src/wix-navigation-tracker.ts` rename attribute keys: `view.name` → `screen.name`, `view.previous` → `last.screen.name`. Remove `view.transition_type`.
- [x] 8.2 Change span name from `"Navigation: ${componentName}"` to plain `componentName`
- [x] 8.3 Pass `instrumentationName: "@inox/react-native-edot-wix-navigation"` to the native span call
- [x] 8.4 Stash the most recent `ComponentDidAppear` event in module state so it is available to the foreground re-emitter
- [x] 8.5 Register a foreground re-emitter inside `registerEdotNavigationListener(...)`. Reset `previousScreenName = null`, then if a stashed event exists, re-run the same handler that processes live `ComponentDidAppear` events.
- [x] 8.6 Cleanup function returned by `registerEdotNavigationListener(...)` clears the stashed event and calls the unregister function from 8.5
- [x] 8.7 Update `packages/react-native-wix-navigation/src/__tests__/wix-navigation-tracker.test.ts`: rename assertions, add foreground replay tests, add `instrumentationName` assertion, ensure duplicate-event suppression still works

## 9. Network / Error / Interaction Enrichment

- [x] 9.1 In `packages/react-native/src/instrumentation/fetch.ts`: rename `view.name` → `screen.name`, `view.id` → `screen.id`. Pass `instrumentationName: "@inox/react-native-edot-sdk/fetch"` to span starts.
- [x] 9.2 In `packages/react-native/src/instrumentation/xhr.ts`: same rename. Pass `instrumentationName: "@inox/react-native-edot-sdk/xhr"`.
- [x] 9.3 In `packages/react-native/src/instrumentation/errors.ts`: rename `view.name` → `screen.name` and add `screen.id` from `ActiveViewContext`. Pass `instrumentationName: "@inox/react-native-edot-sdk/errors"`.
- [x] 9.4 In `packages/react-native/src/interactions/with-edot-tracking.tsx` and `packages/react-native/src/interactions/use-edot-action.ts`: rename `view.name` → `screen.name` on action attributes
- [x] 9.5 In `packages/react-native/src/lifecycle.ts` (startup tracing): pass `instrumentationName: "@inox/react-native-edot-sdk/startup"` *(actual file: `instrumentation/startup.ts`)*
- [x] 9.6 Update Jest tests for fetch.ts, xhr.ts, errors.ts, with-edot-tracking.tsx, use-edot-action.ts: rename attribute assertions; add `screen.id` assertion where applicable

## 10. Documentation Updates

- [x] 10.1 Update root `AGENTS.md` (`packages/react-native/AGENTS.md` and root) — replace `view.name` / `view.id` references with `screen.name` / `screen.id`, document new `appStateTracking` flag, document per-instrumentation tracer scopes
- [x] 10.2 Update `packages/react-native/AGENTS.md` "Network Instrumentation" and "Error Tracking" sections for renamed attributes
- [x] 10.3 Update `packages/react-native/ios/AGENTS.md` to document the deferred-gap: native-only iOS spans (lifecycle, AppMetrics, CrashReporting, third-party native URLSession) do NOT carry `screen.name`. Reference design D7.
- [x] 10.4 Update `packages/react-native-navigation/AGENTS.md` — span name format, attribute names, foreground re-emit behavior
- [x] 10.5 Update `packages/react-native-expo-router/AGENTS.md` — same
- [x] 10.6 Update `packages/react-native-wix-navigation/AGENTS.md` — same plus last-event replay description
- [x] 10.7 Update `packages/shared/AGENTS.md` — document `registerForegroundReEmitter` API
- [x] 10.8 Update `openspec/specs/navigation-tracking.md` (legacy file format) so its content matches the new requirements after archive — or coordinate with `/opsx:archive` flow

## 11. Lint Guard Against Regression

- [x] 11.1 Add a lightweight grep/Jest test (or oxlint rule) that fails the build if `view.name`, `view.previous`, `view.transition_type`, or `view.id` appear as string literals anywhere outside `__tests__` historical fixtures and `openspec/changes/archive/`. Placed at `packages/react-native/src/__tests__/legacyAttrGuard.test.ts`.

## 12. Validation

- [x] 12.1 Run `yarn typecheck` (composite build) — must pass
- [x] 12.2 Run `yarn test` across all packages — must pass (296 tests across 28 suites passing)
- [x] 12.3 Run `yarn lint` (oxlint) — must pass (0 warnings, 0 errors on 78 files)
- [x] 12.4 Run `yarn fmt` (oxfmt) — must pass (298 files normalized)
- [x] 12.5 Run `yarn build` (bob build for all `@inox/*` packages) — must pass
- [x] 12.6 Build `example/basic` for both iOS and Android, both architectures (`yarn ios`, `yarn ios:old-arch`, `yarn android`, `yarn android:old-arch`) and verify telemetry payloads contain `screen.name` and per-instrumentation scope, and AppState transitions end/restart spans correctly *(verified by user manual test)*
- [x] 12.7 Build at least one navigation example app end-to-end (`example/react-navigation` recommended) and verify navigation spans, foreground re-emit, and network/error correlation on the wire *(verified by user manual test across all navigation example apps)*
