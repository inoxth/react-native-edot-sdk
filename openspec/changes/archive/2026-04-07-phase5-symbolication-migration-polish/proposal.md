## Why

Phase 4 delivered navigation plugins that all couple to `@inox/react-native-edot-sdk/active-view-context` — an internal subpath not intended as a public contract. Production JS error stacks are also minified and unreadable without source map symbolication, leaving crash debugging blind. Phase 5 fixes the coupling by extracting shared state to `@inox/react-native-edot-shared`, implements a source map upload CLI, and applies final quality polish across the SDK.

## What Changes

- Extract `ActiveViewContext` from `@inox/react-native-edot-sdk` into a new `@inox/react-native-edot-shared` package so navigation plugins have a stable, non-circular dependency
- Update all navigation plugins (`react-native-navigation`, `react-native-wix-navigation`, `react-native-expo-router`) and the main package to import `ActiveViewContext` from `@inox/react-native-edot-shared`
- Implement `@inox/react-native-edot-cli` source map upload command (`edot upload-sourcemap`) for symbolicating production JS crash stacks
- Add `service.name`, `service.version`, and `deployment.environment` to error spans so the server can route source maps correctly
- Polish: expand test coverage for view-correlation paths, fix any outstanding lint/type issues, update example app to demonstrate symbolication upload

## Capabilities

### New Capabilities
- `core-package`: Shared `@inox/react-native-edot-shared` package that owns `ActiveViewContext` and its listener API, resolving the circular import between navigation plugins and the main package
- `source-map-cli`: CLI command `edot upload-sourcemap` that reads a compiled JS bundle and its source map, then uploads them to the configured EDOT server for server-side symbolication of crash stack traces

### Modified Capabilities
- `active-view-context`: Import source changes from `@inox/react-native-edot-sdk/active-view-context` to `@inox/react-native-edot-shared`; spec updated to reflect new package home
- `js-error-handler`: Error spans must include `service.name`, `service.version`, and `deployment.environment` resource attributes so the backend can match stacks to the correct source map bundle

## Impact

- `packages/shared/` — new package scaffolded and populated
- `packages/react-native/src/activeViewContext.ts` — moved/re-exported from core
- `packages/react-native-navigation/`, `packages/react-native-wix-navigation/`, `packages/react-native-expo-router/` — peer dependency updated
- `packages/cli/` — new CLI entry point and upload command
- `packages/react-native/src/instrumentation/errors.ts` — add resource attributes to error spans
- Example app — add source map upload script to build pipeline demonstration
