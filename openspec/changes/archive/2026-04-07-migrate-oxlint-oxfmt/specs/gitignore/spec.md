## ADDED Requirements

### Requirement: Root gitignore for monorepo
The project SHALL have a `.gitignore` at the repository root that excludes: `node_modules/`, `lib/` (build output), `.yarn/cache/`, iOS build artifacts (`Pods/`, `build/`, `*.xcworkspace/xcuserdata`), Android build artifacts (`*.apk`, `*.aab`, `.gradle/`, `build/`), IDE files (`.idea/`, `.vscode/settings.json`), OS files (`.DS_Store`, `Thumbs.db`), and environment files (`.env`, `.env.*`).

#### Scenario: node_modules not tracked
- **WHEN** `yarn install` creates `node_modules/` in any workspace
- **THEN** `git status` does not show `node_modules/` as untracked

#### Scenario: Build output not tracked
- **WHEN** `yarn build` generates `lib/` in a package directory
- **THEN** `git status` does not show `lib/` as untracked

#### Scenario: iOS Pods not tracked
- **WHEN** `pod install` generates `Pods/` in the example app
- **THEN** `git status` does not show `Pods/` as untracked
