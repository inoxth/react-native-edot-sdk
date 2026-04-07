## ADDED Requirements

### Requirement: `@inox-edot/core` package scaffold
The monorepo SHALL include a `packages/core` package named `@inox-edot/core` with its own `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL have zero React Native dependencies — only plain TypeScript.

#### Scenario: Core package builds independently
- **WHEN** `yarn build` is run inside `packages/core`
- **THEN** the package compiles without errors
- **THEN** no `react-native` imports appear in the output

### Requirement: `ActiveViewContext` lives in `@inox-edot/core`
The `ActiveViewContext` singleton (with `setActiveView`, `getActiveView`, `addChangeListener`, `removeChangeListener`) SHALL be defined in `packages/core/src/activeViewContext.ts` and exported from `packages/core/src/index.ts`.

#### Scenario: Navigation plugin imports ActiveViewContext from core
- **WHEN** `@inox-edot/react-native-navigation` imports `ActiveViewContext`
- **THEN** the import resolves to `@inox-edot/core`
- **THEN** no import from `@inox-edot/react-native` is needed

### Requirement: `@inox-edot/react-native` re-exports ActiveViewContext from core
The main package SHALL re-export `ActiveViewContext` from `@inox-edot/core` so the existing subpath export `@inox-edot/react-native/active-view-context` continues to work without changes to consumer code.

#### Scenario: Existing subpath import still resolves
- **WHEN** code imports from `@inox-edot/react-native/active-view-context`
- **THEN** the import resolves to the same `ActiveViewContext` singleton from `@inox-edot/core`
- **THEN** no runtime error or duplicate singleton is created
