# Session Management Specification

## Purpose
Expose session lifecycle, user identity, and session-level attributes via the JS API.

## Requirements

- MUST delegate session creation and lifecycle to EDOT native SDKs
- MUST provide `getCurrentSessionId()` async method that returns the native session ID
- MUST provide `setUser({ id, email?, name? })` to associate user identity with session
- MUST provide `clearUser()` to remove user identity
- MUST provide `setSessionAttribute(key, value)` for session-level key-value pairs
- MUST attach `session.id` to all spans, metrics, and logs automatically (handled by native SDK)

### Tracking Consent
- MUST support `trackingConsent` config with values: `'granted'`, `'pending'`, `'not_granted'`
- MUST buffer telemetry locally when consent is `'pending'`
- MUST flush buffer when consent transitions to `'granted'`
- MUST purge buffer and stop collection when consent is `'not_granted'`
- MUST provide `setTrackingConsent(consent)` for runtime consent changes

### Scenarios

#### Scenario: User identity set and cleared
- **Given** the SDK is initialized
- **When** `setUser({ id: 'user-123', email: 'test@example.com' })` is called
- **Then** subsequent spans include user identity attributes
- **When** `clearUser()` is called
- **Then** subsequent spans no longer include user identity

#### Scenario: Consent pending then granted
- **Given** the SDK is initialized with `trackingConsent: 'pending'`
- **When** spans are created during the pending period
- **Then** they are buffered locally but NOT exported
- **When** `setTrackingConsent('granted')` is called
- **Then** all buffered spans are flushed to the OTLP exporter

### Requirement: Global attributes API
The SDK SHALL provide `setGlobalAttribute(key, value)` and `removeGlobalAttribute(key)` methods. Global attributes SHALL be attached to ALL spans, metrics, and logs. Values SHALL support types: string, number, boolean.

#### Scenario: Global attribute added and appears on spans
- **WHEN** `EdotReactNative.setGlobalAttribute('tenant_id', 'acme')` is called
- **THEN** subsequent spans include the attribute `tenant_id: acme`

#### Scenario: Global attribute removed
- **GIVEN** a global attribute `tenant_id` was previously set
- **WHEN** `EdotReactNative.removeGlobalAttribute('tenant_id')` is called
- **THEN** subsequent spans no longer include `tenant_id`

### Requirement: Config-provided global attributes
The SDK SHALL accept `globalAttributes` in `EdotConfig` as initial global attributes applied at initialization time. These SHALL be set before any spans are created.

#### Scenario: Initial global attributes from config
- **GIVEN** config includes `globalAttributes: { 'app.variant': 'premium' }`
- **WHEN** the SDK is initialized
- **THEN** all spans created after initialization include `app.variant: premium`