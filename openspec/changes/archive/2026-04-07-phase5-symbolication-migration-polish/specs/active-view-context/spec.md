## MODIFIED Requirements

### Requirement: Exported via subpath from core package
The module SHALL be the canonical export of `@inox/react-native-edot-shared`. Navigation plugins SHALL import `ActiveViewContext` from `@inox/react-native-edot-shared`. The `@inox/react-native-edot-sdk/active-view-context` subpath SHALL continue to work as a re-export of `@inox/react-native-edot-shared` for backwards compatibility.

#### Scenario: Import from core package
- **WHEN** a navigation plugin imports `{ ActiveViewContext } from '@inox/react-native-edot-shared'`
- **THEN** it resolves to the ActiveViewContext singleton
- **THEN** it is the same singleton instance used by the main SDK package

#### Scenario: Legacy subpath import still works
- **WHEN** code imports `{ ActiveViewContext } from '@inox/react-native-edot-sdk/active-view-context'`
- **THEN** it resolves to the same ActiveViewContext from `@inox/react-native-edot-shared`
- **THEN** no duplicate singleton is created
