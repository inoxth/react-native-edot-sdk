# app-state-tracking

## Purpose

Lifecycle handling that ends the active screen-lifetime span on app background and re-emits the current screen on foreground, gated by an SDK-owned `AppState` listener. The `'inactive'` state is filtered out so transient phone-call / Face ID / app-switcher transitions do not thrash spans.

## Requirements

### Requirement: SDK-owned AppState listener
The `@inox/react-native-edot-sdk` package SHALL install a single `AppState.addEventListener('change', ...)` listener during `EdotReactNative.initialize()`, gated by the new defaults flag `appStateTracking` (default `true`). The teardown returned by the setup function SHALL be stored in the SDK's `teardowns[]` and invoked by `_resetForTesting()`.

#### Scenario: Single listener installed on initialize
- **WHEN** `EdotReactNative.initialize(config)` is called and `config.instrumentation.appStateTracking !== false`
- **THEN** exactly one `AppState` change listener SHALL be registered
- **AND** the registration's teardown SHALL be tracked for cleanup

#### Scenario: Listener disabled via config
- **WHEN** `EdotReactNative.initialize({ ..., instrumentation: { appStateTracking: false } })` is called
- **THEN** no `AppState` listener SHALL be registered
- **AND** background/foreground transitions SHALL NOT affect the active screen-lifetime span

### Requirement: End screen-lifetime span on background
On `AppState` change to `'background'`, the listener SHALL read `ActiveViewContext.getActiveView()`, end the span via `EdotNativeModule.endSpan(spanId, 1)` if non-null, and call `ActiveViewContext.clearActiveView()`. The listener SHALL set an internal `wasBackgrounded` flag to `true`.

#### Scenario: Background ends active span
- **GIVEN** an active screen-lifetime span exists with `spanId = "abc"` for screen `"Home"`
- **WHEN** the OS reports `AppState` change to `'background'`
- **THEN** `EdotNativeModule.endSpan("abc", 1)` SHALL be called
- **AND** `ActiveViewContext.getActiveView()` SHALL return `null`
- **AND** the internal `wasBackgrounded` flag SHALL be `true`

#### Scenario: Background with no active screen
- **GIVEN** `ActiveViewContext.getActiveView()` returns `null`
- **WHEN** `AppState` changes to `'background'`
- **THEN** `endSpan` SHALL NOT be called
- **AND** `wasBackgrounded` SHALL be set to `true`

### Requirement: Ignore `'inactive'` state
The listener SHALL NOT take any action when `AppState` changes to `'inactive'`. Specifically, it SHALL NOT end the active screen-lifetime span, SHALL NOT clear `ActiveViewContext`, and SHALL NOT set `wasBackgrounded`.

#### Scenario: Transient inactive does not end span
- **GIVEN** an active screen-lifetime span exists for screen `"Home"`
- **WHEN** the OS reports `AppState` change to `'inactive'` (e.g. Face ID prompt, app switcher half-pulled)
- **AND** then back to `'active'` without an intervening `'background'`
- **THEN** the original span SHALL still be active
- **AND** no foreground re-emitters SHALL be invoked

### Requirement: Foreground re-emit only after real background
On `AppState` change to `'active'`, the listener SHALL invoke registered foreground re-emitters only if `wasBackgrounded === true`. After invoking, it SHALL reset `wasBackgrounded` to `false`.

#### Scenario: Foreground after background invokes re-emitters
- **GIVEN** the app was previously backgrounded (`wasBackgrounded === true`)
- **AND** plugin P registered a foreground re-emitter `fn`
- **WHEN** `AppState` changes to `'active'`
- **THEN** `fn` SHALL be called exactly once
- **AND** `wasBackgrounded` SHALL be `false`

#### Scenario: Foreground without prior background does not re-emit
- **GIVEN** `wasBackgrounded === false`
- **WHEN** `AppState` changes to `'active'` (e.g. transient inactive resolved)
- **THEN** no foreground re-emitters SHALL be invoked

### Requirement: Foreground re-emit treats screen as fresh visit
Each plugin's foreground re-emitter SHALL reset its internal `previousScreenName` (or equivalent module-state field) to `null` before re-running its first-emission path. The resulting screen-lifetime span SHALL omit the `last.screen.name` attribute even if the foregrounded screen matches the screen visible before the background event.

#### Scenario: Foregrounded same-screen omits last.screen.name
- **GIVEN** the app was on screen `"Home"` when backgrounded
- **WHEN** the app foregrounds back to `"Home"`
- **THEN** a new screen-lifetime span SHALL be created with `screen.name = "Home"`
- **AND** the new span SHALL NOT include the `last.screen.name` attribute
- **AND** the new span SHALL have a different `screen.id` than the prior span

### Requirement: Default `appStateTracking` flag
The SDK's `EDOT_DEFAULTS` SHALL include `appStateTracking: true`. The flag SHALL be honored by `mergeConfig()` and surfaced as `config.instrumentation.appStateTracking?: boolean` in the public `EdotConfig` type.

#### Scenario: Default value
- **WHEN** `EdotReactNative.initialize(config)` is called with `config.instrumentation` omitted or without `appStateTracking`
- **THEN** the AppState listener SHALL be installed
