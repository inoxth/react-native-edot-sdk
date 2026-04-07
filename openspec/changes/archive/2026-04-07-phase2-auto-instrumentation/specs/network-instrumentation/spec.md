## ADDED Requirements

### Requirement: Network instrumentation wired into initialize
The SDK SHALL automatically set up fetch and XHR instrumentation when `EdotReactNative.initialize()` is called with `instrumentNetworkRequests: true` (the default). Instrumentation SHALL be teardown-able via an internal cleanup mechanism.

#### Scenario: Network instrumentation active after init
- **WHEN** `EdotReactNative.initialize()` is called with default config
- **THEN** `global.fetch` is patched
- **THEN** `XMLHttpRequest.prototype.open` and `.send` are patched
- **THEN** subsequent HTTP requests create spans

#### Scenario: Network instrumentation disabled
- **WHEN** `instrumentNetworkRequests: false` is configured
- **THEN** `global.fetch` is NOT patched
- **THEN** `XMLHttpRequest` is NOT patched
