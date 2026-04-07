## 1. Scaffold `@inox-edot/core` package

- [x] 1.1 Create `packages/core/package.json` with name `@inox-edot/core`, no React Native dependencies
- [x] 1.2 Create `packages/core/tsconfig.json` and `packages/core/tsconfig.build.json`
- [x] 1.3 Create `packages/core/src/index.ts` exporting `ActiveViewContext`
- [x] 1.4 Move `ActiveViewContext` implementation from `packages/react-native/src/activeViewContext.ts` to `packages/core/src/activeViewContext.ts`
- [x] 1.5 Add `@inox-edot/core` to root tsconfig references

## 2. Wire backwards compatibility in main package

- [x] 2.1 Replace `packages/react-native/src/activeViewContext.ts` with a re-export from `@inox-edot/core`
- [x] 2.2 Add `@inox-edot/core` as a dependency in `packages/react-native/package.json`
- [x] 2.3 Verify the `./active-view-context` subpath export in `packages/react-native/package.json` still resolves correctly

## 3. Update navigation plugins to use `@inox-edot/core`

- [x] 3.1 Add `@inox-edot/core` as a dependency in `packages/react-native-navigation/package.json`
- [x] 3.2 Update imports in `packages/react-native-navigation/src/` from `@inox-edot/react-native/active-view-context` to `@inox-edot/core`
- [x] 3.3 Add `@inox-edot/core` as a dependency in `packages/react-native-wix-navigation/package.json`
- [x] 3.4 Update imports in `packages/react-native-wix-navigation/src/` from `@inox-edot/react-native/active-view-context` to `@inox-edot/core`
- [x] 3.5 Add `@inox-edot/core` as a dependency in `packages/react-native-expo-router/package.json`
- [x] 3.6 Update imports in `packages/react-native-expo-router/src/` from `@inox-edot/react-native/active-view-context` to `@inox-edot/core`

## 4. Add service attributes to error spans

- [x] 4.1 Create a module-level config reference in `packages/react-native/src/instrumentation/errors.ts` set during `setupErrorHandler()`
- [x] 4.2 Update `reportError()` to attach `service.name`, `service.version`, `deployment.environment` to error span attributes
- [x] 4.3 Apply same attributes to Promise rejection spans (shared via `reportError`)
- [x] 4.4 Update unit tests for `errors.ts` to assert service attribute presence

## 5. Implement `@inox-edot/cli`

- [x] 5.1 Create `packages/cli/package.json` with `bin: { edot: './lib/index.js' }` and Commander as a dependency
- [x] 5.2 Create `packages/cli/tsconfig.json`
- [x] 5.3 Implement `packages/cli/src/index.ts` with Commander entry point and `upload-sourcemap` subcommand
- [x] 5.4 Implement `upload-sourcemap` command: read bundle and source map from disk, POST multipart to `<serverUrl>/intake/v2/sourcemaps`
- [x] 5.5 Add authentication header support (`--secret-token`, `--api-key`)
- [x] 5.6 Handle HTTP error responses with non-zero exit code and error message
- [x] 5.7 Write unit tests for CLI argument parsing and request construction

## 6. Verify and polish

- [x] 6.1 Run `yarn build` across all packages and confirm no type or build errors
- [x] 6.2 Run full test suite and confirm all tests pass
- [x] 6.3 Verify no circular dependency warnings in the workspace graph
