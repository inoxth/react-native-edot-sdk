## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Shared linting and formatting
**Reason**: Replaced by oxlint/oxfmt (above). ESLint + Prettier removed.
**Migration**: `yarn lint` now runs oxlint instead of ESLint. `yarn fmt` runs oxfmt instead of Prettier.
