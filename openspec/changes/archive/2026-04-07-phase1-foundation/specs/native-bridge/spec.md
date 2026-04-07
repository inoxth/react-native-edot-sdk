## ADDED Requirements

### Requirement: iOS native module wrapping EDOT iOS SDK
The SDK SHALL provide a Swift native module (`EdotReactNative`) that wraps the EDOT iOS SDK (ElasticApm v2.0.0 via SPM from `github.com/elastic/apm-agent-ios`). The module SHALL be distributed via CocoaPods with a podspec declaring `React-Core` as a dependency. The EDOT iOS SDK SHALL be added by the consumer app via Swift Package Manager. The minimum iOS deployment target SHALL be 16.0.

#### Scenario: iOS native module is available after pod install
- **WHEN** a React Native app adds `@inox-edot/react-native` and runs `pod install`
- **THEN** the `EdotReactNative` native module is available via `NativeModules` or TurboModuleRegistry

### Requirement: Android native module wrapping EDOT Android SDK
The SDK SHALL provide a Kotlin native module (`EdotReactNativeModule`) that uses the OpenTelemetry API (`io.opentelemetry:opentelemetry-api:1.60.1`) for spans, metrics, and logs. The EDOT Android agent (`co.elastic.otel.android.agent` Gradle plugin v1.5.0) SHALL be applied by the consumer app, which sets up `GlobalOpenTelemetry` at runtime. The module SHALL be distributed via Gradle with dependencies declared in `build.gradle.kts`. The module SHALL be registered via `EdotReactNativePackage`.

#### Scenario: Android native module is available after Gradle sync
- **WHEN** a React Native app adds `@inox-edot/react-native` and syncs Gradle
- **THEN** the `EdotReactNative` native module is available via `NativeModules` or TurboModuleRegistry

### Requirement: TurboModule spec for New Architecture
The SDK SHALL provide a TurboModule spec (`NativeEdotReactNative.ts`) defining the complete native interface. The spec SHALL be used by codegen to generate C++ bindings for JSI. All bridge methods SHALL be defined in this spec.

#### Scenario: TurboModule codegen produces valid bindings
- **WHEN** React Native codegen runs against `NativeEdotReactNative.ts`
- **THEN** valid C++ bindings are generated without errors
- **THEN** the native modules conform to the generated spec interface

### Requirement: Dual architecture runtime detection
The SDK SHALL detect the active architecture at runtime by checking `global.__turboModuleProxy != null`. When TurboModules are available, it SHALL import via `TurboModuleRegistry.getEnforcing`. Otherwise, it SHALL fall back to `NativeModules.EdotReactNative`.

#### Scenario: SDK loads TurboModule on New Architecture
- **GIVEN** the app is running with New Architecture enabled
- **WHEN** the SDK initializes
- **THEN** it loads the native module via `TurboModuleRegistry`

#### Scenario: SDK loads NativeModules on Old Architecture
- **GIVEN** the app is running with Old Architecture (Bridge)
- **WHEN** the SDK initializes
- **THEN** it loads the native module via `NativeModules.EdotReactNative`

### Requirement: No-op fallback when native module is missing
The SDK SHALL provide a Proxy-based no-op module when the native module cannot be loaded. All methods SHALL return resolved promises (async) or `undefined` (sync) without throwing. A single console warning SHALL be logged: `"[EDOT] Native module not found. Telemetry will be disabled."`.

#### Scenario: App runs without native module linked
- **GIVEN** the native module is NOT linked (pod install not run or Gradle not synced)
- **WHEN** `EdotReactNative.initialize(config)` is called
- **THEN** a warning is logged to console
- **THEN** the promise resolves without error
- **THEN** all subsequent API calls are no-ops and do not throw

### Requirement: Synchronous span ID return from native
The `startSpan` native method SHALL return a span ID string synchronously. On Android, this SHALL use `isBlockingSynchronousMethod = true`. On iOS, this SHALL use a synchronous bridge method. Spans SHALL be stored in a thread-safe native registry.

#### Scenario: Span ID returned synchronously
- **WHEN** `startSpan('test', {}, null)` is called from JS
- **THEN** a non-empty string span ID is returned synchronously (not via promise)
- **THEN** the span is stored in the native span registry

### Requirement: Thread-safe native span registry
iOS SHALL use `NSLock` or `os_unfair_lock` to protect the span dictionary. Android SHALL use `ConcurrentHashMap<String, Span>`. The registry SHALL support concurrent start/end operations from multiple native threads.

#### Scenario: Concurrent span operations are safe
- **GIVEN** multiple spans are being created and ended from different threads
- **WHEN** `startSpan` and `endSpan` are called concurrently
- **THEN** no data corruption or crashes occur
