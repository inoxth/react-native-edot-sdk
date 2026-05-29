# Monorepo Scaffold Specification

## Purpose
Define the monorepo structure, build tooling, and shared configuration for the React Native EDOT SDK project.

## Requirements

### Requirement: Yarn Workspaces monorepo structure
The project SHALL use Yarn Workspaces to manage a monorepo containing the core SDK package and future plugin packages. The root `package.json` SHALL define workspace paths including `packages/*`.

#### Scenario: Monorepo resolves internal dependencies
- **WHEN** a workspace package declares a dependency on `@inoxth/react-native-edot-sdk`
- **THEN** Yarn resolves it to the local workspace package without publishing

### Requirement: TypeScript strict mode configuration
The project SHALL use TypeScript with `strict: true` and project references for each workspace package. A root `tsconfig.json` SHALL define shared compiler options, and each package SHALL extend it.

#### Scenario: Type-check passes across all packages
- **WHEN** `tsc --build` is run at the root
- **THEN** all packages compile without errors under strict mode

### Requirement: react-native-builder-bob build tooling
Each library package SHALL use react-native-builder-bob to produce CommonJS, ESM, and TypeScript declaration outputs. The `bob build` command SHALL be the standard build step.

#### Scenario: Library package builds all output formats
- **WHEN** `bob build` is run in a library package
- **THEN** `lib/commonjs/`, `lib/module/`, and `lib/typescript/` directories are produced
- **THEN** the `package.json` `main`, `module`, and `types` fields point to the correct outputs

### Requirement: Shared linting and formatting
The root SHALL configure oxlint via `oxlintrc.json` with TypeScript and React plugins enabled. Formatting SHALL use oxfmt with settings: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`. All packages SHALL be covered by the root config. The `yarn lint` script SHALL run `oxlint`. A `yarn fmt` script SHALL run `oxfmt`.

#### Scenario: Lint check runs across workspace
- **WHEN** `yarn lint` is run at the root
- **THEN** oxlint checks all `.ts` and `.tsx` files in all packages
- **THEN** zero errors are reported on a clean codebase

#### Scenario: Format check runs across workspace
- **WHEN** `yarn fmt` is run at the root
- **THEN** oxfmt formats all `.ts` and `.tsx` files in all packages
- **THEN** no formatting changes are needed on a clean codebase

### Requirement: Jest test infrastructure
The root SHALL configure Jest with `react-native` preset. Each package SHALL have its own Jest config extending the root. Tests SHALL use TypeScript via `ts-jest` or bob's transform.

#### Scenario: Unit tests run from root
- **WHEN** `yarn test` is run at the root
- **THEN** Jest discovers and runs tests across all packages
- **THEN** results are reported per-package

### Requirement: Core package directory structure
The `@inoxth/react-native-edot-sdk` package SHALL follow this structure:
- `src/` — TypeScript source
- `ios/` — Swift native module + podspec
- `android/` — Kotlin native module + build.gradle.kts
- `src/__tests__/` — Unit tests

#### Scenario: Package structure is valid
- **WHEN** the package is inspected
- **THEN** `src/index.ts` exists as the entry point
- **THEN** `ios/EdotReactNative.podspec` exists
- **THEN** `android/build.gradle.kts` exists
