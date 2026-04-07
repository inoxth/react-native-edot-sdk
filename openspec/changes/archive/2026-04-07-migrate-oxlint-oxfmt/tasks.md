## 1. Create .gitignore

- [x] 1.1 Create root `.gitignore` with patterns for: node_modules, lib, .yarn/cache, iOS (Pods, build, xcuserdata), Android (apk, aab, .gradle, build), IDE (.idea, .vscode/settings.json), OS (.DS_Store), env files (.env*)

## 2. Remove ESLint + Prettier

- [x] 2.1 Remove `eslint`, `@react-native/eslint-config`, `prettier` from root `package.json` devDependencies
- [x] 2.2 Delete `.eslintrc.js`, `.prettierrc`, `.eslintignore`
- [x] 2.3 Run `yarn install` to update lockfile

## 3. Add oxlint

- [x] 3.1 Add `oxlint` to root `package.json` devDependencies
- [x] 3.2 Create `oxlintrc.json` at root with TypeScript + React plugins, correctness + suspicious categories
- [x] 3.3 Update root `package.json` `lint` script to run `oxlint ./packages`
- [x] 3.4 Update `packages/react-native/package.json` `lint` script to run `oxlint src/`

## 4. Add oxfmt

- [x] 4.1 Create root formatting script `fmt` in `package.json` using `oxfmt .`
- [x] 4.2 Run `oxfmt` on entire codebase to normalize formatting
- [x] 4.3 Verify no formatting diff remains after running `oxfmt`

## 5. Update references

- [x] 5.1 Update `.claude/agents/build-error-resolver.md` to reference oxlint/oxfmt instead of ESLint/Prettier
- [x] 5.2 Verify Claude hooks (`enforce-oxlint.sh`, `enforce-oxfmt.sh`) reference correct binaries

## 6. Verify

- [x] 6.1 Run `yarn lint` — zero errors on clean codebase
- [x] 6.2 Run `yarn fmt` — no changes on clean codebase
- [x] 6.3 Run `yarn typecheck` — still passes
- [x] 6.4 Run `yarn test` — still passes
- [x] 6.5 Run `yarn build` — still passes
