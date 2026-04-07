## Why

ESLint + Prettier is slow and requires many transitive dependencies (`@react-native/eslint-config` pulls in 50+ packages). oxlint is 50-100x faster, and oxfmt is a drop-in Prettier replacement written in Rust. Migrating reduces `yarn lint` time, simplifies config, and cuts dependency count. Additionally, the project has no `.gitignore`, which risks committing `node_modules`, build artifacts, and IDE files.

## What Changes

- Remove `eslint`, `@react-native/eslint-config`, `prettier`, and all ESLint plugins from root `devDependencies`
- Remove `.eslintrc.js`, `.prettierrc`, `.eslintignore` config files
- Add `oxlint` and configure via `oxlintrc.json` with TypeScript + React Native rules
- Add `oxfmt` and configure formatting to match current Prettier settings (single quotes, trailing commas, 100 print width)
- Update `package.json` scripts: `lint` → `oxlint`, add `fmt` → `oxfmt`
- Update `packages/react-native/package.json` lint script
- Create `.gitignore` for the monorepo (node_modules, lib, build artifacts, iOS Pods, Android build, IDE files)
- Update `.claude/agents/build-error-resolver.md` to reference new tooling
- Remove Claude hooks that reference ESLint/Prettier (`enforce-oxlint.sh`, `enforce-oxfmt.sh` already exist — verify they point to correct binaries)

## Capabilities

### New Capabilities
- `gitignore`: Root `.gitignore` covering monorepo patterns (node_modules, lib, build outputs, native build dirs, IDE files)

### Modified Capabilities
- `monorepo-scaffold`: Linting and formatting tooling changes from ESLint/Prettier to oxlint/oxfmt

## Impact

- **Removed deps**: `eslint`, `@react-native/eslint-config`, `prettier`, and all transitive ESLint plugins (~50 packages)
- **Added deps**: `oxlint` (single binary, no transitive deps)
- **Config files removed**: `.eslintrc.js`, `.prettierrc`, `.eslintignore`
- **Config files added**: `oxlintrc.json`, `.gitignore`
- **Scripts changed**: `yarn lint`, `yarn fmt` in root and package-level `package.json`
- **CI impact**: Any CI referencing `eslint` or `prettier` commands must update
