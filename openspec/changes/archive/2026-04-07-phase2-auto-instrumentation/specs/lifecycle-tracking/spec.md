## ADDED Requirements

### Requirement: AppState lifecycle span creation
The SDK SHALL listen to React Native's `AppState` changes and create spans for each transition. Span names: `AppLifecycle: foreground` (active), `AppLifecycle: background`, `AppLifecycle: inactive`. Each span SHALL include `app.state` and `session.id` attributes.

#### Scenario: App goes to background
- **WHEN** the app transitions from `active` to `background`
- **THEN** a span named `AppLifecycle: background` is created
- **THEN** `app.state` is set to `background`

#### Scenario: App returns to foreground
- **WHEN** the app transitions from `background` to `active`
- **THEN** a span named `AppLifecycle: foreground` is created
- **THEN** `app.state` is set to `active`

### Requirement: Lifecycle tracking respects config toggle
Lifecycle tracking SHALL only be active when `config.instrumentAppLifecycle` is `true`.

#### Scenario: Lifecycle tracking disabled
- **WHEN** `instrumentAppLifecycle: false` is configured
- **THEN** no AppState listener is registered
- **THEN** no lifecycle spans are created
