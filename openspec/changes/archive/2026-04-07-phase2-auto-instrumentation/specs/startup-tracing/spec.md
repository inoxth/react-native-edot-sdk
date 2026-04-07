## ADDED Requirements

### Requirement: App startup span with phases
The SDK SHALL create an `AppStartup` parent span with child spans for: native initialization, JS bundle load, and first render. The span SHALL include `app.startup.type` (cold/warm), `app.startup.duration_ms`, `app.startup.js_bundle_load_ms`, and `app.startup.first_render_ms` attributes.

#### Scenario: Cold start traced with phases
- **WHEN** the app launches from a killed state
- **THEN** an `AppStartup: cold` span is created
- **THEN** `app.startup.js_bundle_load_ms` reflects time from native start to JS init
- **THEN** `app.startup.first_render_ms` reflects time from JS init to first render

### Requirement: Startup tracing respects config toggle
Startup tracing SHALL only be active when `config.instrumentAppStartup` is `true`.

#### Scenario: Startup tracing disabled
- **WHEN** `instrumentAppStartup: false` is configured
- **THEN** no startup span is created
