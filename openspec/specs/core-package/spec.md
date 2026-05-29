# core-package

## Purpose

Provides a shared `@inoxth/react-native-edot-shared` package containing platform-agnostic utilities (e.g., ActiveViewContext) that other SDK packages depend on without requiring React Native.

## Requirements

### Requirement: `@inoxth/react-native-edot-shared` package scaffold
The monorepo SHALL include a `packages/shared` package named `@inoxth/react-native-edot-shared` with its own `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL have zero React Native dependencies — only plain TypeScript.

#### Scenario: Core package builds independently
- **WHEN** `yarn build` is run inside `packages/shared`
- **THEN** the package compiles without errors
- **THEN** no `react-native` imports appear in the output

### Requirement: `ActiveViewContext` lives in `@inoxth/react-native-edot-shared`
The `ActiveViewContext` singleton (with `setActiveView`, `getActiveView`, `addChangeListener`, `removeChangeListener`) SHALL be defined in `packages/shared/src/activeViewContext.ts` and exported from `packages/shared/src/index.ts`.

#### Scenario: Navigation plugin imports ActiveViewContext from core
- **WHEN** `@inoxth/react-native-edot-navigation` imports `ActiveViewContext`
- **THEN** the import resolves to `@inoxth/react-native-edot-shared`
- **THEN** no import from `@inoxth/react-native-edot-sdk` is needed

### Requirement: `@inoxth/react-native-edot-sdk` re-exports ActiveViewContext from core
The main package SHALL re-export `ActiveViewContext` from `@inoxth/react-native-edot-shared` so the existing subpath export `@inoxth/react-native-edot-sdk/active-view-context` continues to work without changes to consumer code.

#### Scenario: Existing subpath import still resolves
- **WHEN** code imports from `@inoxth/react-native-edot-sdk/active-view-context`
- **THEN** the import resolves to the same `ActiveViewContext` singleton from `@inoxth/react-native-edot-shared`
- **THEN** no runtime error or duplicate singleton is created
