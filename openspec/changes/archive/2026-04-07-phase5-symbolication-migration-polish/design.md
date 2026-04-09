## Context

Phase 4 shipped navigation plugins (`react-native-navigation`, `react-native-wix-navigation`, `react-native-expo-router`) that each import `ActiveViewContext` via `@inox/react-native-edot-sdk/active-view-context`. This creates a tight coupling: navigation packages depend on the main SDK package through an internal subpath. The `packages/shared` directory exists in the monorepo but is empty — it was always intended to hold cross-cutting shared state.

Separately, production React Native bundles are minified. The SDK captures `error.stack` on crash, but that stack is full of minified identifiers (`a.b`, line 1 col 42350) that are unreadable without server-side symbolication. The `packages/cli` directory is similarly scaffolded but empty.

## Goals / Non-Goals

**Goals:**
- Populate `@inox/react-native-edot-shared` with `ActiveViewContext` and decouple navigation plugins from the main package
- Implement `edot upload-sourcemap` CLI command for source map upload
- Add `service.name`, `service.version`, `deployment.environment` to error spans for backend routing
- Zero breaking changes to the public `@inox/react-native-edot-sdk` API surface

**Non-Goals:**
- Client-side symbolication (server handles this)
- Migrating any other instrumentation code to `core`
- Changing the `ActiveViewContext` singleton API or behavior
- Supporting non-OTLP export in the CLI

## Decisions

### D1: `@inox/react-native-edot-shared` owns `ActiveViewContext` singleton

**Decision**: Move `ActiveViewContext` from `packages/react-native/src/activeViewContext.ts` into `packages/shared/src/activeViewContext.ts`. Re-export it from `@inox/react-native-edot-sdk` for backwards compatibility.

**Rationale**: Navigation plugins need the singleton but cannot depend on the main package without creating a circular or at minimum an over-broad dependency. `@inox/react-native-edot-shared` has no React Native dependencies — just plain JS — so every package can safely depend on it.

**Alternative considered**: Keep it in `@inox/react-native-edot-sdk/active-view-context` subpath and treat it as a stable contract. Rejected: subpath internals are fragile and this pattern was never documented as public API.

### D2: CLI is a standalone Node.js binary using Commander

**Decision**: `packages/cli/src/index.ts` exports a Commander-based CLI with an `upload-sourcemap` subcommand. It reads the bundle + source map from disk and POSTs them to `<serverUrl>/intake/v2/sourcemaps`.

**Rationale**: Commander is the de-facto standard for Node CLI tools; zero exotic dependencies. The endpoint mirrors the Elastic APM server sourcemap intake API which EDOT is compatible with.

**Alternative considered**: Use `meow` (lighter). Rejected: Commander has better subcommand support for when more CLI commands are added later.

### D3: Error spans include resource attributes at report time

**Decision**: `reportError()` in `errors.ts` reads `service.name`, `service.version`, and `deployment.environment` from a module-level config reference set during `initialize()`, and attaches them to the error span attributes.

**Rationale**: The EDOT server needs these values to look up which source map bundle to apply. Embedding them in the span is simpler than requiring the server to join on session data.

**Alternative considered**: Rely on the native SDK's resource attributes already flowing through. Rejected: JS error spans are created on the JS side and the native resource attributes are not necessarily accessible at error-reporting time.

### D4: Re-export `ActiveViewContext` from the main package for backwards compat

**Decision**: `packages/react-native/src/activeViewContext.ts` becomes a barrel re-export from `@inox/react-native-edot-shared`. The package.json subpath export `./active-view-context` continues to work.

**Rationale**: Any consumer already importing the subpath continues to work without changes.

## Risks / Trade-offs

- **Circular build order risk**: `@inox/react-native-edot-shared` must be built before all consumers. The monorepo build order (turborepo/yarn workspaces) must declare the dependency correctly. → Mitigation: add `@inox/react-native-edot-shared` as a `dependencies` entry in each navigation package's `package.json`.
- **Source map upload endpoint compatibility**: EDOT server intake URL may differ per deployment. → Mitigation: CLI accepts `--server-url` and `--service-name` as required flags; no defaults assumed.
- **Error span attribute duplication**: Adding resource attributes to every error span increases payload size slightly. → Acceptable: 3 string attributes per error span is negligible overhead.

## Migration Plan

1. Scaffold and implement `packages/shared`
2. Move `ActiveViewContext` implementation; add re-export shim in `packages/react-native`
3. Update navigation packages to import from `@inox/react-native-edot-shared` (peer dep update)
4. Implement `packages/cli`
5. Update `errors.ts` to attach resource attributes
6. Verify all packages build cleanly and tests pass

Rollback: Each step is independently revertable via git. No database migrations or infra changes required.

## Open Questions

- Does the EDOT APM server intake accept sourcemaps at `/intake/v2/sourcemaps`? (Assumed yes based on Elastic APM compat; verify against server docs before shipping CLI)
- Should the CLI support multiple bundles in one command (iOS + Android + hermes)? (Deferred to a future phase; single-bundle upload is sufficient for v1)
