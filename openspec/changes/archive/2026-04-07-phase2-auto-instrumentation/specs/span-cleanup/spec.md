## ADDED Requirements

### Requirement: Orphaned span cleanup timer
The SDK SHALL run a periodic cleanup every 60 seconds that ends any span older than 5 minutes with status `DEADLINE_EXCEEDED`. The cleanup timer SHALL be stopped on SDK teardown.

#### Scenario: Orphaned span cleaned up
- **WHEN** a span is started but never ended
- **WHEN** 5 minutes elapse
- **THEN** the cleanup timer ends the span with `DEADLINE_EXCEEDED` status

### Requirement: SDK error isolation
All instrumentation code (fetch patch, XHR patch, error handler, lifecycle listener) SHALL be wrapped in try-catch. Instrumentation errors SHALL NEVER crash the host app. Errors SHALL be logged only when `config.debug` is `true`.

#### Scenario: Instrumentation error does not crash app
- **WHEN** the fetch instrumentation throws an internal error
- **THEN** the original fetch request completes normally
- **THEN** the app does not crash
- **THEN** if `debug: true`, the error is logged to console
