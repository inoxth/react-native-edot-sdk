## ADDED Requirements

### Requirement: Foreground re-emitter registration API
The `ActiveViewContext` module SHALL export `registerForegroundReEmitter(fn: () => void): () => void`. Each call SHALL append `fn` to an internal re-emitter registry and return an unregister function that removes only that registration.

#### Scenario: Register and unregister
- **WHEN** `const unregister = ActiveViewContext.registerForegroundReEmitter(fn)` is called
- **THEN** `fn` SHALL be tracked in the re-emitter registry
- **AND** calling `unregister()` SHALL remove `fn` from the registry
- **AND** `unregister()` SHALL be idempotent (safe to call multiple times)

#### Scenario: Multiple plugins register
- **WHEN** two plugins each call `registerForegroundReEmitter(fnA)` and `registerForegroundReEmitter(fnB)`
- **THEN** both `fnA` and `fnB` SHALL be tracked
- **AND** unregistering one SHALL NOT affect the other

### Requirement: Re-emitter invocation API
The `ActiveViewContext` module SHALL provide a way for the SDK's AppState handler to invoke all registered re-emitters in registration order. This SHALL be exposed as `notifyForegroundReEmitters(): void` (or equivalent internal API documented in the package's AGENTS.md).

#### Scenario: All re-emitters invoked
- **GIVEN** `fnA` and `fnB` are registered
- **WHEN** `ActiveViewContext.notifyForegroundReEmitters()` is called
- **THEN** `fnA` SHALL be invoked exactly once
- **AND** `fnB` SHALL be invoked exactly once

#### Scenario: Re-emitter exception does not block others
- **GIVEN** `fnA` (which throws) and `fnB` (which succeeds) are registered
- **WHEN** `notifyForegroundReEmitters()` is called
- **THEN** `fnB` SHALL still be invoked
- **AND** the exception from `fnA` SHALL NOT propagate out of `notifyForegroundReEmitters()`

### Requirement: Re-emitter registry cleared on `_resetForTesting()`
When `ActiveViewContext._resetForTesting()` is called (in `__DEV__` only, per existing convention), the foreground re-emitter registry SHALL be cleared in addition to clearing the active view and listeners.

#### Scenario: Reset clears re-emitters
- **GIVEN** `fnA` is registered as a foreground re-emitter
- **WHEN** `_resetForTesting()` is called
- **THEN** the re-emitter registry SHALL be empty
- **AND** subsequent `notifyForegroundReEmitters()` calls SHALL NOT invoke `fnA`
