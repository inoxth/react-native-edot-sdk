## ADDED Requirements

### Requirement: Error tracking wired into initialize
The SDK SHALL automatically set up JS error handlers when `EdotReactNative.initialize()` is called with `instrumentJsErrors: true` (the default). The global error handler and Promise rejection tracker SHALL be installed during initialization.

#### Scenario: Error tracking active after init
- **WHEN** `EdotReactNative.initialize()` is called with default config
- **THEN** `ErrorUtils.setGlobalHandler()` installs the SDK's error handler
- **THEN** the Hermes Promise rejection tracker is enabled
- **THEN** subsequent uncaught exceptions create spans
