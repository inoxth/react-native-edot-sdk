## MODIFIED Requirements

### Requirement: Initialization
- MUST provide an `EdotReactNative.initialize(config)` async method that starts the native EDOT agents
- MUST accept an `EdotConfig` TypeScript interface with required fields: `serverUrl`, `serviceName`, `serviceVersion`, `deploymentEnvironment`
- MUST support mutually exclusive authentication via `secretToken` OR `apiKey`
- MUST support optional native-side pre-initialization for crash capture before JS bundle loads
- MUST NOT start the native agent twice if `preInitialize` was already called natively
- MUST default `exportProtocol` to `'otlp/http'`
- MUST default `sessionSamplingRate` to `1.0`
- SHALL validate config at initialization and throw descriptive errors for invalid values
- SHOULD support `debug` flag that enables verbose console logging
- MUST support `debugExportToConsole` flag that logs OTLP payloads to console
- MUST support platform-specific config sections (`ios.*`, `android.*`) forwarded to respective native modules only
- MUST forward `config.ios.enableMetricKit` and `config.ios.enableViewControllerTracing` to iOS native module
- MUST forward `config.android.enableAnrDetection`, `config.android.enableSlowRenderingDetection`, and `config.android.diskBufferingEnabled` to Android native module
- MUST track initialization state and warn on duplicate `initialize()` calls

#### Scenario: Successful initialization
- **Given** a valid EdotConfig with serverUrl, serviceName, serviceVersion, deploymentEnvironment
- **When** `EdotReactNative.initialize(config)` is called
- **Then** the native EDOT agent starts with the provided configuration
- **And** the promise resolves without error
- **And** `EdotReactNative.getCurrentSessionId()` returns a non-empty string

#### Scenario: Missing native module
- **Given** the native module is NOT linked (e.g., pod install was not run)
- **When** `EdotReactNative.initialize(config)` is called
- **Then** a warning is logged to console: "[EDOT] Native module not found..."
- **And** all subsequent API calls are no-ops (do not throw)
- **And** the host app does NOT crash

#### Scenario: Pre-initialization followed by JS initialization
- **Given** `EdotReactNativeAgent.preInitialize(...)` was called in AppDelegate/MainApplication
- **When** `EdotReactNative.initialize(config)` is called from JS
- **Then** the JS-specific config (network patching, error handling) is merged
- **And** the native agent is NOT restarted

#### Scenario: Debug mode enables verbose logging
- **Given** config includes `debug: true`
- **When** the SDK is initialized and operates
- **Then** `[EDOT]` prefixed log messages appear in the console for all telemetry events

#### Scenario: Platform-specific config forwarding
- **Given** config includes `ios: { enableMetricKit: false }` and `android: { enableAnrDetection: false }`
- **When** initialized on iOS
- **Then** `enableMetricKit: false` is forwarded to the iOS native module
- **And** the `android` config section is ignored

### Requirement: Platform Support
- MUST work on React Native 0.72 and above
- MUST support both Old Architecture (Bridge/NativeModules) and New Architecture (TurboModules/JSI)
- MUST detect architecture at runtime and load the appropriate native module
- MUST provide a no-op fallback if the native module is not linked (graceful degradation)

#### Scenario: Successful initialization
- **Given** a valid EdotConfig with serverUrl, serviceName, serviceVersion, deploymentEnvironment
- **When** `EdotReactNative.initialize(config)` is called
- **Then** the native EDOT agent starts with the provided configuration
- **And** the promise resolves without error
- **And** `EdotReactNative.getCurrentSessionId()` returns a non-empty string
