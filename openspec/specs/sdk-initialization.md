# SDK Initialization Specification

## Purpose
Define the configuration interface, validation rules, and initialization lifecycle for the EDOT React Native SDK.

## Requirements

### Requirement: EdotConfig TypeScript interface
The SDK SHALL export an `EdotConfig` interface with required fields: `serverUrl` (string), `serviceName` (string), `serviceVersion` (string), `deploymentEnvironment` (string). Optional fields SHALL include: `secretToken`, `apiKey`, `exportProtocol`, `sessionSamplingRate`, `instrumentNetworkRequests`, `instrumentJsErrors`, `instrumentNativeCrashes`, `instrumentAppLifecycle`, `tracePropagationTargets`, `ignoreUrls`, `ios`, `android`, `trackingConsent`, `urlSanitizer`, `requestHeadersToCapture`, `responseHeadersToCapture`, `globalAttributes`, `instrumentAppStartup`, `codePushVersion`, `graphqlUrls`, `debug`, `debugExportToConsole`.

#### Scenario: Config interface provides full type safety
- **WHEN** a developer writes `EdotReactNative.initialize(config)` in TypeScript
- **THEN** the compiler enforces all required fields are present
- **THEN** optional fields are correctly typed with their defaults documented via JSDoc

### Requirement: Config validation at initialization
The `initialize()` method SHALL validate the config synchronously before any native calls. It SHALL throw an `Error` with a descriptive message for: missing required fields, `sessionSamplingRate` outside 0.0-1.0, both `secretToken` and `apiKey` provided, invalid `exportProtocol` value.

#### Scenario: Missing required field throws
- **WHEN** `initialize({ serverUrl: 'https://apm.example.com' })` is called without `serviceName`
- **THEN** an Error is thrown with message containing "serviceName is required"

#### Scenario: Invalid sampling rate throws
- **WHEN** `initialize({ ...validConfig, sessionSamplingRate: 1.5 })` is called
- **THEN** an Error is thrown with message containing "sessionSamplingRate must be between 0.0 and 1.0"

#### Scenario: Mutually exclusive auth throws
- **WHEN** `initialize({ ...validConfig, secretToken: 'a', apiKey: 'b' })` is called
- **THEN** an Error is thrown with message containing "secretToken and apiKey are mutually exclusive"

### Requirement: Initialize starts native EDOT agent
The `initialize()` method SHALL translate `EdotConfig` into the native config format and call the native module's `initialize` method. It SHALL return a Promise that resolves when the native agent is started.

#### Scenario: Successful initialization
- **WHEN** `EdotReactNative.initialize(validConfig)` is called
- **THEN** the native EDOT agent starts with the provided configuration
- **THEN** the returned promise resolves without error

### Requirement: Default config values
The SDK SHALL apply these defaults when optional fields are omitted: `exportProtocol: 'otlp/http'`, `sessionSamplingRate: 1.0`, `instrumentNetworkRequests: true`, `instrumentJsErrors: true`, `instrumentNativeCrashes: true`, `instrumentAppLifecycle: true`, `instrumentAppStartup: true`, `trackingConsent: 'granted'`, `debug: false`, `debugExportToConsole: false`.

#### Scenario: Defaults applied for minimal config
- **WHEN** `initialize({ serverUrl, serviceName, serviceVersion, deploymentEnvironment })` is called
- **THEN** `exportProtocol` is `'otlp/http'`
- **THEN** `sessionSamplingRate` is `1.0`
- **THEN** `debug` is `false`

### Requirement: Native pre-initialization support
The native modules SHALL expose a `preInitialize(serverUrl, secretToken?, serviceName?, serviceVersion?, deploymentEnvironment?)` static method callable from AppDelegate (iOS) or MainApplication (Android). This SHALL start the native EDOT agent with minimal config for early crash capture. Any provided `serviceName`/`serviceVersion`/`deploymentEnvironment` SHALL be injected into the OpenTelemetry `Resource` so emitted telemetry carries the correct service identity from the first span onward. A subsequent JS `initialize()` call SHALL merge JS-specific config without restarting the agent.

#### Scenario: Pre-init followed by JS init
- **GIVEN** `EdotReactNativeAgent.preInitialize(serverUrl, secretToken, serviceName, serviceVersion, deploymentEnvironment)` was called in native code
- **WHEN** `EdotReactNative.initialize(config)` is called from JS
- **THEN** the native agent is NOT restarted
- **THEN** JS-specific config (debug flags, instrumentation toggles) is applied
- **THEN** the service identity supplied to `preInitialize` remains the authoritative Resource value

### Requirement: Prevent double initialization
The SDK SHALL track initialization state. Calling `initialize()` a second time SHALL log a warning and return the existing session without restarting.

#### Scenario: Double initialization is ignored
- **GIVEN** `EdotReactNative.initialize(config)` has already been called
- **WHEN** `EdotReactNative.initialize(config)` is called again
- **THEN** a warning is logged: "[EDOT] SDK already initialized, ignoring duplicate call"
- **THEN** the promise resolves without error

### Requirement: Platform-specific config forwarding
The SDK SHALL forward `config.ios.*` options to the iOS native module only and `config.android.*` options to the Android native module only. Unrecognized platform options SHALL be ignored.

#### Scenario: iOS-specific config applied on iOS
- **GIVEN** config includes `ios: { enableMetricKit: true }`
- **WHEN** initialized on iOS
- **THEN** the native module receives `enableMetricKit: true`
- **WHEN** initialized on Android
- **THEN** the `ios` config is ignored
