## MODIFIED Requirements

### Requirement: Global JS error capture
The SDK SHALL install a global error handler via `ErrorUtils.setGlobalHandler()` that creates an OTel span with `error.source: js_uncaught`. The handler SHALL chain with the existing handler (call it after recording). The error SHALL be forwarded to the native module via `reportJsException()`. The error span SHALL include `service.name`, `service.version`, and `deployment.environment` attributes sourced from the SDK config so the EDOT backend can match the span to the correct source map bundle.

#### Scenario: Uncaught exception recorded and forwarded
- **WHEN** an uncaught `TypeError` occurs
- **THEN** a span with `exception.type: TypeError` and `error.source: js_uncaught` is created
- **THEN** `reportJsException` is called on the native module
- **THEN** the original React Native error handler is still called

#### Scenario: Error span includes service resource attributes
- **WHEN** the SDK is initialized with `serviceName: 'my-app'`, `serviceVersion: '2.0.0'`, `deploymentEnvironment: 'production'`
- **WHEN** an uncaught exception occurs
- **THEN** the error span includes `service.name: 'my-app'`
- **THEN** the error span includes `service.version: '2.0.0'`
- **THEN** the error span includes `deployment.environment: 'production'`

## ADDED Requirements

### Requirement: Promise rejection span includes service attributes
Unhandled Promise rejection spans SHALL also include `service.name`, `service.version`, and `deployment.environment` attributes using the same config source as the global error handler.

#### Scenario: Promise rejection span has service context
- **WHEN** a Promise rejects without a handler
- **WHEN** the SDK was initialized with `serviceName: 'my-app'`, `serviceVersion: '1.5.0'`
- **THEN** the rejection span includes `service.name: 'my-app'` and `service.version: '1.5.0'`
