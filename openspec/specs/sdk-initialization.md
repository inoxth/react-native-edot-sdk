# SDK Initialization Specification

## Purpose
Define the configuration interface, validation rules, and initialization lifecycle for the React Native EDOT SDK.

## Requirements

### Requirement: EdotConfig TypeScript interface
The SDK SHALL export an `EdotConfig` interface where `serverUrl` (string), `serviceVersion` (string), and `deploymentEnvironment` (string) are required, and `serviceName` (string) is optional at the type level. Optional fields SHALL include: `secretToken`, `apiKey`, `exportProtocol`, `sessionSamplingRate`, `instrumentNetworkRequests`, `instrumentJsErrors`, `instrumentNativeCrashes`, `instrumentAppLifecycle`, `tracePropagationTargets`, `ignoreUrls`, `ios`, `android`, `trackingConsent`, `urlSanitizer`, `requestHeadersToCapture`, `responseHeadersToCapture`, `globalAttributes`, `instrumentAppStartup`, `codePushVersion`, `graphqlUrls`, `debug`, `debugExportToConsole`. The `EdotIosConfig` and `EdotAndroidConfig` interfaces SHALL each accept an optional `serviceName?: string` field which, when present, overrides the top-level `serviceName` on that platform.

#### Scenario: Top-level serviceName remains the simplest form
- **WHEN** a developer writes `EdotReactNative.initialize({ serverUrl, serviceName: 'myapp', serviceVersion, deploymentEnvironment })`
- **THEN** the compiler accepts the call
- **THEN** `serviceName: 'myapp'` is the value used on both iOS and Android

#### Scenario: Per-platform serviceName overrides without a top-level value
- **WHEN** a developer writes `EdotReactNative.initialize({ serverUrl, serviceVersion, deploymentEnvironment, ios: { serviceName: 'myapp-ios' }, android: { serviceName: 'myapp-android' } })`
- **THEN** the compiler accepts the call (no top-level `serviceName` required)
- **THEN** on iOS the resolved service name is `'myapp-ios'`
- **THEN** on Android the resolved service name is `'myapp-android'`

#### Scenario: Per-platform serviceName overrides a top-level fallback
- **WHEN** a developer writes `EdotReactNative.initialize({ serverUrl, serviceName: 'myapp', serviceVersion, deploymentEnvironment, ios: { serviceName: 'myapp-ios-special' } })`
- **THEN** on iOS the resolved service name is `'myapp-ios-special'`
- **THEN** on Android the resolved service name is `'myapp'`

### Requirement: Config validation at initialization
The `initialize()` method SHALL validate the config synchronously before any native calls. It SHALL throw an `Error` with a descriptive message for: missing required fields, `sessionSamplingRate` outside 0.0-1.0, both `secretToken` and `apiKey` provided, invalid `exportProtocol` value, and resource-identity values containing `,` or `=` characters. Validation of `serviceName` SHALL operate on the **resolved** value for the active `Platform.OS` — that is, `config[Platform.OS]?.serviceName ?? config.serviceName`. If the resolved value is missing or empty, the error message SHALL include guidance to set either the top-level `serviceName` or the active platform's override. Validation of `serviceVersion`, `deploymentEnvironment`, and `serverUrl` SHALL continue to operate on the top-level value only.

#### Scenario: Missing top-level serviceName with no platform override throws on the active platform
- **GIVEN** `Platform.OS === 'ios'`
- **WHEN** `initialize({ serverUrl, serviceVersion, deploymentEnvironment, android: { serviceName: 'myapp-android' } })` is called
- **THEN** an Error is thrown with a message containing `serviceName is required` and mentioning `top-level serviceName or ios.serviceName / android.serviceName`

#### Scenario: Platform-override serviceName satisfies validation when top-level is absent
- **GIVEN** `Platform.OS === 'ios'`
- **WHEN** `initialize({ serverUrl, serviceVersion, deploymentEnvironment, ios: { serviceName: 'myapp-ios' } })` is called
- **THEN** validation passes for the `serviceName` requirement

#### Scenario: Platform-override serviceName is subject to character restrictions
- **GIVEN** `Platform.OS === 'ios'`
- **WHEN** `initialize({ serverUrl, serviceVersion, deploymentEnvironment, ios: { serviceName: 'foo,bar' } })` is called
- **THEN** an Error is thrown with a message containing `must not contain ',' or '='`

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
The native modules SHALL expose a `preInitialize(serverUrl, serviceName, serviceVersion, deploymentEnvironment, secretToken?)` static method callable from AppDelegate (iOS) or MainApplication (Android; the `Application` instance is passed as an additional first positional argument on Android). `serverUrl`, `serviceName`, `serviceVersion`, and `deploymentEnvironment` SHALL be required and non-blank; each resource-identity value SHALL NOT contain `,` or `=` characters (which would corrupt the iOS `OTEL_RESOURCE_ATTRIBUTES` serialization). A blank or disallowed value SHALL cause `preInitialize` to throw (`IllegalArgumentException` on Android; `NSInvalidArgumentException` on iOS) before the agent starts. These values SHALL be injected into the OpenTelemetry `Resource` so emitted telemetry carries the correct service identity from the first span onward. A subsequent JS `initialize()` call SHALL merge JS-specific config without restarting the agent.

#### Scenario: Pre-init followed by JS init
- **GIVEN** `EdotReactNativeAgent.preInitialize(serverUrl, serviceName, serviceVersion, deploymentEnvironment, secretToken)` was called in native code with valid values
- **WHEN** `EdotReactNative.initialize(config)` is called from JS
- **THEN** the native agent is NOT restarted
- **THEN** JS-specific config (debug flags, instrumentation toggles) is applied
- **THEN** the service identity supplied to `preInitialize` remains the authoritative Resource value

#### Scenario: Pre-init rejects blank resource identity
- **WHEN** `EdotReactNativeAgent.preInitialize(...)` is called with an empty `deploymentEnvironment`
- **THEN** the call throws before the Elastic agent starts
- **THEN** no telemetry with `service.environment: "default"` is produced

### Requirement: Prevent double initialization
The SDK SHALL track initialization state. Calling `initialize()` a second time SHALL log a warning and return the existing session without restarting.

#### Scenario: Double initialization is ignored
- **GIVEN** `EdotReactNative.initialize(config)` has already been called
- **WHEN** `EdotReactNative.initialize(config)` is called again
- **THEN** a warning is logged: "[EDOT] SDK already initialized, ignoring duplicate call"
- **THEN** the promise resolves without error

### Requirement: Platform-specific config forwarding
The SDK SHALL forward `config.ios.*` options to the iOS native module only and `config.android.*` options to the Android native module only. Unrecognized platform options SHALL be ignored. When `config.ios.serviceName` (resp. `config.android.serviceName`) is present, the SDK SHALL use it as the effective `serviceName` on iOS (resp. Android) by resolving via the platform block first and falling back to the top-level value. The bridge payload sent to native SHALL contain a single flat `serviceName` key — the platform-block override SHALL NOT be sent twice or in addition to the top-level value.

#### Scenario: iOS-specific config applied on iOS
- **GIVEN** config includes `ios: { enableMetricKit: true }`
- **WHEN** initialized on iOS
- **THEN** the native module receives `enableMetricKit: true`
- **WHEN** initialized on Android
- **THEN** the `ios` config is ignored

#### Scenario: iOS serviceName override reaches the native bridge as a flat key
- **GIVEN** `Platform.OS === 'ios'` and config has `serviceName: 'myapp'` and `ios: { serviceName: 'myapp-ios' }`
- **WHEN** `initialize(config)` is called
- **THEN** the native bridge receives `serviceName: 'myapp-ios'`
- **THEN** the native bridge does NOT receive a nested `ios.serviceName` field

#### Scenario: Android serviceName override is ignored on iOS
- **GIVEN** `Platform.OS === 'ios'` and config has `serviceName: 'myapp'` and `android: { serviceName: 'myapp-android' }`
- **WHEN** `initialize(config)` is called
- **THEN** the native bridge receives `serviceName: 'myapp'`
