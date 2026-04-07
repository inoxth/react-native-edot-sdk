## Context

We are building the EDOT React Native SDK — a wrapper around the native EDOT iOS (v2.x) and Android (v1.x) SDKs that exposes a unified TypeScript API for OpenTelemetry-compliant observability. This is the foundational phase: monorepo setup, native modules, initialization, session management, and dual-architecture support. All subsequent phases (auto-instrumentation, navigation plugins, manual APIs) depend on this layer.

Key constraints:
- Must support RN 0.72+ with both Bridge and New Architecture (TurboModules/JSI)
- Native telemetry is delegated entirely to EDOT native SDKs — the JS layer augments, not reimplements
- Must never crash the host app — graceful degradation is mandatory
- Monorepo structure must accommodate future packages (`react-native-navigation`, `expo-router`, `tracer-provider`, etc.)

## Goals / Non-Goals

**Goals:**
- Establish a production-ready monorepo with build tooling, TypeScript strict mode, and CI
- Implement iOS (Swift) and Android (Kotlin) native modules wrapping EDOT SDK initialization
- Support both Old Architecture and New Architecture via conditional module loading
- Expose `EdotReactNative.initialize(config)` with full `EdotConfig` validation
- Support native-side `preInitialize` for early crash capture, with JS-side merge
- Expose session management and global attributes APIs via the native bridge
- Auto-detect resource attributes (device, OS, RN version, architecture)
- Provide a no-op fallback when the native module is missing
- Create a minimal example app for integration testing

**Non-Goals:**
- Network request instrumentation (Phase 2)
- Error/crash tracking JS handlers (Phase 2)
- Navigation tracking plugins (Phase 3)
- Manual instrumentation APIs / TracerProvider (Phase 3)
- Tracking consent buffering logic (Phase 3)
- Source map upload CLI (Phase 4)
- Expo config plugin (Phase 4)

## Decisions

### 1. Monorepo tooling: Yarn Workspaces + react-native-builder-bob

**Decision**: Use Yarn Workspaces for package management and react-native-builder-bob for library builds.

**Rationale**: bob is the de-facto standard for React Native library builds — it handles CommonJS, ESM, and TypeScript declarations out of the box. Yarn Workspaces are well-tested with React Native's metro bundler (pnpm symlinks cause issues with metro without extra config). This matches the embrace-io SDK's proven monorepo pattern.

**Alternatives considered**:
- pnpm workspaces — better disk efficiency but metro compatibility requires `node-linker=hoisted` and extra config
- Turborepo — adds build orchestration overhead we don't need yet; can add later

### 2. Dual architecture support: Conditional module loading at runtime

**Decision**: Detect TurboModule availability via `global.__turboModuleProxy != null` and conditionally import the TurboModule spec or fall back to `NativeModules`.

**Rationale**: This is the standard React Native pattern for libraries supporting both architectures. The TurboModule codegen spec (`NativeEdotReactNative.ts`) defines the contract; on old arch, the same methods are exposed via `NativeModules.EdotReactNative`. No build-time branching needed.

### 3. Native module design: Thin bridge, delegate to EDOT SDKs

**Decision**: The native modules are thin wrappers. On iOS, the module uses `#if canImport(ElasticApm)` to conditionally call the EDOT iOS SDK (ElasticApm v2.0.0 via SPM), falling back to stubs when absent. On Android, the module uses `GlobalOpenTelemetry` from the OTel API — the EDOT Android Gradle plugin (`co.elastic.otel.android.agent` v1.5.0) sets up the OTel SDK at build/runtime. The library itself only depends on `io.opentelemetry:opentelemetry-api`.

**Rationale**: The PRD's "Native-First Telemetry" principle — EDOT handles all low-level capture. The iOS SDK is SPM-only (no CocoaPods pod), so `#if canImport` allows the pod to compile without it. The Android EDOT SDK is a Gradle plugin (bytecode instrumentation), not a library dependency — so the native module accesses OTel via the standard `GlobalOpenTelemetry` API that the plugin provisions at runtime.

### 4. Pre-initialization: Native flag to prevent double-start

**Decision**: The native module maintains an `isInitialized` boolean. `preInitialize()` sets it and starts the native agent with minimal config. When `initialize()` is called from JS, it checks this flag — if already initialized, it merges JS-specific config (like debug flags) without restarting the agent.

**Rationale**: Crash capture must start before the JS bundle loads. The merge approach ensures native early-init and JS late-init work together without conflicts. The EDOT iOS SDK's `AgentConfigBuilder` pattern supports incremental configuration.

### 5. No-op fallback module: Proxy-based implementation

**Decision**: When the native module is not found, create a `Proxy`-based no-op that returns resolved promises for async methods and `undefined` for sync methods. Log a single console warning.

**Rationale**: A Proxy avoids maintaining a manual stub for every method. If new methods are added to the native module, the no-op automatically handles them. This ensures the SDK never crashes the app during development when native setup is incomplete.

**Alternative considered**: Manual stub object with explicit no-op methods — more explicit but requires maintenance on every API change.

### 6. Config validation: Fail-fast with descriptive errors

**Decision**: Validate `EdotConfig` synchronously at the start of `initialize()`. Throw `Error` with specific messages for: missing required fields, invalid `sessionSamplingRate` range, mutually exclusive `secretToken`/`apiKey`, and invalid `exportProtocol`.

**Rationale**: Runtime config errors are painful to debug in mobile apps. Failing fast with clear messages during development saves significant debugging time. Validation runs before any native bridge calls.

### 7. Resource attribute detection: Hybrid JS + native

**Decision**: RN-specific attributes (`rn.version`, `rn.hermes`, `rn.architecture`) are detected in JS. Platform attributes (`os.type`, `os.version`, `device.model.identifier`, `device.manufacturer`, `app.build`) are read from the native module. Both are merged into the OTel resource.

**Rationale**: Some attributes are only available in JS (React Native version from `react-native` package), while device info requires native APIs. The native EDOT SDKs already collect platform attributes — we read them rather than reimplementing detection.

### 8. Span ID management: Native-side registry with synchronous ID return

**Decision**: `startSpan()` on Android uses `isBlockingSynchronousMethod = true` to return the span ID synchronously via JSI. On iOS, the same synchronous pattern applies via the bridge. Spans are stored in a concurrent-safe native registry (`ConcurrentHashMap` on Android, `NSLock`-protected `Dictionary` on iOS).

**Rationale**: Asynchronous span ID return would break the mental model of `const span = startSpan(...)` and complicate parent-child relationships. Synchronous return is critical for the manual instrumentation API (Phase 3) but the registry infrastructure must be built now.

## Risks / Trade-offs

**[EDOT SDK version pinning]** Pinning to specific EDOT native SDK versions (iOS ~> 2.0, Android latest 1.x) may miss bug fixes or security patches.
→ **Mitigation**: CI matrix tests against EDOT latest; document supported version ranges in README. Renovate/Dependabot for automated update PRs.

**[Synchronous bridge calls on old arch]** `isBlockingSynchronousMethod` blocks the JS thread on the old architecture bridge. High-frequency span creation could cause jank.
→ **Mitigation**: On old arch, span creation is typically low-frequency (manual instrumentation). Auto-instrumentation (Phase 2) batches bridge calls. Document the performance characteristic.

**[Yarn over pnpm]** Yarn Workspaces uses more disk space than pnpm and hoists aggressively, which can mask missing dependencies.
→ **Mitigation**: Use `nohoist` for React Native native dependencies that need to be in the package's own `node_modules`. Strict TypeScript imports catch missing deps at compile time.

**[Proxy-based no-op]** `Proxy` is not supported in all Hermes versions (though it is in RN 0.72+).
→ **Mitigation**: Verify Hermes Proxy support in our minimum target (RN 0.72 ships Hermes with Proxy). Add a CI test on the oldest supported RN version.

**[Pre-init config merge complexity]** Merging native pre-init config with JS config introduces state management complexity and edge cases (conflicting `serverUrl`, different auth).
→ **Mitigation**: JS config wins for all fields except `serverUrl` and auth (which must match or warn). Document that pre-init config should be minimal (just serverUrl + auth).
