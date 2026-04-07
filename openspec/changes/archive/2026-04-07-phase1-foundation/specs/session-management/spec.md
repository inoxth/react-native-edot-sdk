## ADDED Requirements

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
