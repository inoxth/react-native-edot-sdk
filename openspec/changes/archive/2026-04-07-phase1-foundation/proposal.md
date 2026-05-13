## Why

The React Native EDOT SDK needs its foundational layer before any auto-instrumentation or navigation plugins can be built. Phase 1 establishes the monorepo structure, core native modules (iOS + Android), SDK initialization with full config support, session management bridge, and dual-architecture (Bridge + TurboModule) support. This is the critical path — every subsequent phase depends on these primitives.

## What Changes

- Scaffold monorepo with Yarn/pnpm workspaces, TypeScript strict mode, react-native-builder-bob, and shared tooling (ESLint, Prettier, Jest)
- Create `@inox/react-native-edot-sdk` core package with `EdotReactNative.initialize(config)` API
- Implement iOS native module (Swift) wrapping EDOT iOS SDK (apm-agent-ios v2.0.0 via SPM) initialization
- Implement Android native module (Kotlin) using OpenTelemetry API with EDOT Android Gradle plugin (co.elastic.otel.android.agent v1.5.0)
- Support optional native-side pre-initialization (`preInitialize`) for early crash capture
- Implement TurboModule spec + legacy NativeModules bridge for dual-architecture support
- Implement no-op fallback when native module is not linked (graceful degradation)
- Expose session management APIs: `getCurrentSessionId()`, `setUser()`, `clearUser()`, `setSessionAttribute()`
- Expose global attributes API: `setGlobalAttribute()`, `removeGlobalAttribute()`
- Implement resource attribute auto-detection (OS, device, RN version, architecture)
- Create example app shell for integration testing
- Set up basic unit test infrastructure

## Capabilities

### New Capabilities
- `monorepo-scaffold`: Workspace structure, build tooling, TypeScript config, CI-ready project layout
- `native-bridge`: iOS and Android native modules, TurboModule spec, architecture detection, no-op fallback
- `sdk-initialization`: `EdotReactNative.initialize(config)` with full EdotConfig validation, native agent startup, and pre-init merge logic
- `resource-detection`: Automatic collection of device, OS, RN version, and architecture resource attributes
- `example-app`: Minimal React Native app for manual testing and future E2E test harness

### Modified Capabilities
- `core-sdk`: Adding implementation details for config validation, platform-specific options (`ios.*`, `android.*`), and `debug`/`debugExportToConsole` flags
- `session-management`: Adding implementation details for global attributes API and resource attribute attachment

## Impact

- **New packages**: `@inox/react-native-edot-sdk` (core)
- **Native dependencies**: ElasticApm v2.0.0 (iOS via SPM), `co.elastic.otel.android.agent` Gradle plugin v1.5.0 (Android, applied by consumer), `io.opentelemetry:opentelemetry-api:1.60.1` (Android library dep)
- **Build tooling**: react-native-builder-bob for library builds, TypeScript project references
- **CI**: GitHub Actions pipeline for lint, type-check, unit tests, and iOS/Android build verification
- **APIs introduced**: `EdotReactNative.initialize()`, `getCurrentSessionId()`, `setUser()`, `clearUser()`, `setSessionAttribute()`, `setGlobalAttribute()`, `removeGlobalAttribute()`
