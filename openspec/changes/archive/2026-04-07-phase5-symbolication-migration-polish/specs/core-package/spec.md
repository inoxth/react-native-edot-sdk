## ADDED Requirements

### Requirement: `@inox/react-native-edot-shared` package scaffold
The monorepo SHALL include a `packages/shared` package named `@inox/react-native-edot-shared` with its own `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL have zero React Native dependencies — only plain TypeScript.

#### Scenario: Core package builds independently
- **WHEN** `yarn build` is run inside `packages/shared`
- **THEN** the package compiles without errors
- **THEN** no `react-native` imports appear in the output

### Requirement: `ActiveViewContext` lives in `@inox/react-native-edot-shared`
The `ActiveViewContext` singleton (with `setActiveView`, `getActiveView`, `addChangeListener`, `removeChangeListener`) SHALL be defined in `packages/shared/src/activeViewContext.ts` and exported from `packages/shared/src/index.ts`.

#### Scenario: Navigation plugin imports ActiveViewContext from core
- **WHEN** `@inox/react-native-edot-navigation` imports `ActiveViewContext`
- **THEN** the import resolves to `@inox/react-native-edot-shared`
- **THEN** no import from `@inox/react-native-edot-sdk` is needed

### Requirement: `@inox/react-native-edot-sdk` re-exports ActiveViewContext from core
The main package SHALL re-export `ActiveViewContext` from `@inox/react-native-edot-shared` so the existing subpath export `@inox/react-native-edot-sdk/active-view-context` continues to work without changes to consumer code.

#### Scenario: Existing subpath import still resolves
- **WHEN** code imports from `@inox/react-native-edot-sdk/active-view-context`
- **THEN** the import resolves to the same `ActiveViewContext` singleton from `@inox/react-native-edot-shared`
- **THEN** no runtime error or duplicate singleton is created
