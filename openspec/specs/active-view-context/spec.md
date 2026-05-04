# active-view-context

## Purpose

Provides a singleton context that tracks the currently active view (screen). Navigation plugins write to this context; instrumentation modules (network, error tracking, interactions) read from it to correlate telemetry with the current screen.

## Requirements

### Requirement: Singleton active view state
The module SHALL export an `ActiveViewContext` object providing `setActiveView(view: ActiveView)`, `getActiveView(): ActiveView | null`, and `clearActiveView()`. `ActiveView` SHALL contain `name: string` and `spanId: string`.

#### Scenario: Set and get active view
- **WHEN** `ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'abc123' })` is called
- **THEN** `ActiveViewContext.getActiveView()` returns `{ name: 'HomeScreen', spanId: 'abc123' }`

#### Scenario: Clear active view
- **WHEN** `ActiveViewContext.clearActiveView()` is called
- **THEN** `ActiveViewContext.getActiveView()` returns `null`

### Requirement: Change listener support
The module SHALL support `addListener(callback)` that fires when the active view changes. It SHALL return an unsubscribe function.

#### Scenario: Listener notified on view change
- **WHEN** a listener is registered via `ActiveViewContext.addListener(cb)`
- **AND** `setActiveView` is called with a new view
- **THEN** the callback fires with the new view

#### Scenario: Unsubscribe stops notifications
- **WHEN** the unsubscribe function is called
- **AND** `setActiveView` is called again
- **THEN** the callback does NOT fire

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

### Requirement: Exported via subpath from core package
The module SHALL be the canonical export of `@inox/react-native-edot-shared`. Navigation plugins SHALL import `ActiveViewContext` from `@inox/react-native-edot-shared`. The `@inox/react-native-edot-sdk/active-view-context` subpath SHALL continue to work as a re-export of `@inox/react-native-edot-shared` for backwards compatibility.

#### Scenario: Import from subpath
- **WHEN** a navigation plugin imports `{ ActiveViewContext } from '@inox/react-native-edot-sdk/active-view-context'`
- **THEN** it resolves to the ActiveViewContext module

#### Scenario: Import from core package
- **WHEN** a navigation plugin imports `{ ActiveViewContext } from '@inox/react-native-edot-shared'`
- **THEN** it resolves to the ActiveViewContext singleton
- **THEN** it is the same singleton instance used by the main SDK package

#### Scenario: Legacy subpath import still works
- **WHEN** code imports `{ ActiveViewContext } from '@inox/react-native-edot-sdk/active-view-context'`
- **THEN** it resolves to the same ActiveViewContext from `@inox/react-native-edot-shared`
- **THEN** no duplicate singleton is created
