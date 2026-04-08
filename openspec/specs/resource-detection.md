# Resource Detection Specification

## Purpose
Automatically collect and attach OpenTelemetry resource attributes to all telemetry, including React Native-specific runtime information.

## Requirements

### Requirement: Automatic resource attribute collection
The SDK SHALL automatically collect and attach OTel resource attributes to all telemetry. JS-detected attributes: `rn.version`, `rn.hermes`, `rn.architecture`. Native-detected attributes: `os.type`, `os.version`, `device.model.identifier`, `device.manufacturer`, `app.build`. Config-provided attributes: `service.name`, `service.version`, `deployment.environment`. Hardcoded attributes: `telemetry.sdk.name` (`react-native-edot`), `telemetry.sdk.language` (`javascript`).

#### Scenario: Resource attributes are populated after initialization
- **WHEN** `EdotReactNative.initialize(config)` completes
- **THEN** `telemetry.sdk.name` is set to `react-native-edot`
- **THEN** `os.type` is set to `ios` or `android`
- **THEN** `rn.version` matches the React Native runtime version
- **THEN** `rn.hermes` is `true` when Hermes is the JS engine
- **THEN** `rn.architecture` is `bridge` or `fabric`

### Requirement: RN architecture detection
The SDK SHALL detect the active React Native architecture. It SHALL check `global.__turboModuleProxy != null` for TurboModule support and `global.nativeFabricUIManager != null` for Fabric renderer. The `rn.architecture` attribute SHALL be `fabric` when Fabric is active, otherwise `bridge`.

#### Scenario: Fabric architecture detected
- **GIVEN** the app runs with New Architecture (Fabric) enabled
- **WHEN** resource attributes are collected
- **THEN** `rn.architecture` is set to `fabric`

#### Scenario: Bridge architecture detected
- **GIVEN** the app runs with Old Architecture
- **WHEN** resource attributes are collected
- **THEN** `rn.architecture` is set to `bridge`

### Requirement: Hermes engine detection
The SDK SHALL detect whether Hermes is the active JS engine by checking `global.HermesInternal != null`. The `rn.hermes` attribute SHALL be `true` or `false`.

#### Scenario: Hermes detected
- **GIVEN** the app uses Hermes as the JS engine
- **WHEN** resource attributes are collected
- **THEN** `rn.hermes` is `true`

### Requirement: SDK version from package.json
The `telemetry.sdk.version` attribute SHALL be read from the SDK's own `package.json` version field at build time (injected via bob build or a constant).

#### Scenario: SDK version attribute is correct
- **WHEN** resource attributes are collected
- **THEN** `telemetry.sdk.version` matches the version in `@inox-edot/react-native/package.json`
