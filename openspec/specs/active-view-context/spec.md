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
