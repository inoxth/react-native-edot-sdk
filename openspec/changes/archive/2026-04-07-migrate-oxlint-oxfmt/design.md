## Context

The project currently uses ESLint 8 with `@react-native/eslint-config` and Prettier 2 for linting and formatting. This pulls in ~50 transitive packages and is slow on large codebases. The project also has Claude hooks (`enforce-oxlint.sh`, `enforce-oxfmt.sh`) that already reference oxlint/oxfmt, suggesting the intent to migrate. No `.gitignore` exists — `node_modules`, `lib/`, iOS Pods, and Android build dirs are untracked but at risk of accidental commits.

## Goals / Non-Goals

**Goals:**
- Replace ESLint + Prettier with oxlint + oxfmt for faster linting and formatting
- Match existing code style (single quotes, trailing commas, 100 char width)
- Create a comprehensive `.gitignore` for the monorepo
- Keep the migration non-breaking — same rules, faster tooling

**Non-Goals:**
- Changing code style rules (this is a tooling swap, not a style change)
- Adding new lint rules beyond what ESLint currently enforces
- Migrating any CI pipelines (out of scope — project has no CI yet)

## Decisions

### 1. oxlint config: `oxlintrc.json` at root

**Decision**: Single `oxlintrc.json` at the monorepo root with TypeScript and React plugins enabled. Use `correctness` + `suspicious` + `pedantic` categories to approximate the `@react-native` ESLint config coverage.

**Rationale**: oxlint uses a flat config file. One root config covers all packages. The `@react-native/eslint-config` primarily enables `@typescript-eslint` and React rules — oxlint covers these natively via its built-in TypeScript and React plugins.

**Alternative considered**: Per-package configs — unnecessary since all packages share the same style.

### 2. oxfmt for formatting

**Decision**: Use oxfmt as the formatter with settings matching current Prettier config: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`, `arrowParens: "always"`.

**Rationale**: oxfmt is Prettier-compatible (same AST, same output for most cases) but written in Rust. Drop-in replacement that preserves existing formatting.

### 3. .gitignore: Comprehensive monorepo patterns

**Decision**: Single root `.gitignore` covering: `node_modules`, `lib/`, `.yarn/cache`, iOS (`Pods/`, `*.xcworkspace`, `build/`), Android (`*.apk`, `.gradle/`, `build/`), IDE files (`.idea/`, `.vscode/` settings), OS files (`.DS_Store`), and env files (`.env*`).

**Rationale**: Standard React Native monorepo patterns. Covers both the library packages and the example app's native dirs.

## Risks / Trade-offs

**[oxlint rule coverage gap]** oxlint doesn't implement every ESLint rule. Some `@react-native/eslint-config` rules may not have oxlint equivalents.
→ **Mitigation**: The core rules (no-unused-vars, no-undef, React hooks rules, TypeScript rules) are all covered. Any missing niche rules are acceptable for the speed gain.

**[oxfmt formatting differences]** oxfmt may produce slightly different output than Prettier 2 in edge cases.
→ **Mitigation**: Run `oxfmt` once on the entire codebase after migration to normalize. One-time diff is acceptable.

**[Breaking existing hooks]** Claude hooks `enforce-oxlint.sh` and `enforce-oxfmt.sh` already exist and may need path updates.
→ **Mitigation**: Verify hooks reference the correct binary paths after migration.
