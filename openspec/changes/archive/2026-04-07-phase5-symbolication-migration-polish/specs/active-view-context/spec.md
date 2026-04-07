## MODIFIED Requirements

### Requirement: Exported via subpath from core package
The module SHALL be the canonical export of `@inox-edot/core`. Navigation plugins SHALL import `ActiveViewContext` from `@inox-edot/core`. The `@inox-edot/react-native/active-view-context` subpath SHALL continue to work as a re-export of `@inox-edot/core` for backwards compatibility.

#### Scenario: Import from core package
- **WHEN** a navigation plugin imports `{ ActiveViewContext } from '@inox-edot/core'`
- **THEN** it resolves to the ActiveViewContext singleton
- **THEN** it is the same singleton instance used by the main SDK package

#### Scenario: Legacy subpath import still works
- **WHEN** code imports `{ ActiveViewContext } from '@inox-edot/react-native/active-view-context'`
- **THEN** it resolves to the same ActiveViewContext from `@inox-edot/core`
- **THEN** no duplicate singleton is created
