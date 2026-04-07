## ADDED Requirements

### Requirement: Global JS error capture
The SDK SHALL install a global error handler via `ErrorUtils.setGlobalHandler()` that creates an OTel span with `error.source: js_uncaught`. The handler SHALL chain with the existing handler (call it after recording). The error SHALL be forwarded to the native module via `reportJsException()`.

#### Scenario: Uncaught exception recorded and forwarded
- **WHEN** an uncaught `TypeError` occurs
- **THEN** a span with `exception.type: TypeError` and `error.source: js_uncaught` is created
- **THEN** `reportJsException` is called on the native module
- **THEN** the original React Native error handler is still called

### Requirement: Unhandled Promise rejection capture
The SDK SHALL track unhandled Promise rejections via Hermes rejection tracker (with fallback to `promise/setimmediate/rejection-tracking` for non-Hermes engines). Rejections SHALL be recorded as spans with `error.source: js_promise_rejection`.

#### Scenario: Unhandled promise rejection recorded
- **WHEN** a Promise rejects without a `.catch()` handler
- **THEN** a span with `error.source: js_promise_rejection` is created
- **THEN** `exception.message` contains the rejection reason

### Requirement: EdotErrorBoundary component
The SDK SHALL export an `EdotErrorBoundary` React component that catches render errors via `componentDidCatch`. It SHALL record errors as spans with `error.source: js_render_error` and render a `fallback` prop when an error occurs.

#### Scenario: Render error caught by boundary
- **WHEN** a child component throws during render inside `<EdotErrorBoundary>`
- **THEN** a span with `error.source: js_render_error` is created
- **THEN** the fallback UI is rendered
- **THEN** the app does not crash

### Requirement: Error handler respects config toggle
Error instrumentation SHALL only be active when `config.instrumentJsErrors` is `true`. When `false`, no error handlers SHALL be installed.

#### Scenario: Error handler disabled by config
- **WHEN** `instrumentJsErrors: false` is configured
- **THEN** no global error handler is installed
- **THEN** uncaught exceptions are not captured by the SDK
