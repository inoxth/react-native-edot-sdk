## ADDED Requirements

### Requirement: Basic example with SDK initialization via .env
The basic example app at `example/basic/` SHALL initialize the SDK using configuration from `.env` (server URL, service name, service version, secret token). A `.env.example` file SHALL be provided with placeholder values.

#### Scenario: SDK initializes from .env config
- **WHEN** the developer copies `.env.example` to `.env` and fills in real values
- **THEN** the app reads `EDOT_SERVER_URL`, `EDOT_SERVICE_NAME`, `EDOT_SERVICE_VERSION`, `EDOT_SECRET_TOKEN` from `.env`
- **THEN** the SDK initializes successfully and displays the session ID

### Requirement: Manual tracing demo
The basic example SHALL demonstrate custom span creation using `getTracerProvider()` from `@inoxth/react-native-edot-tracer-provider`.

#### Scenario: User creates a custom span
- **WHEN** the user taps a "Create Span" button
- **THEN** the app creates a span with `tracer.startSpan()`, sets attributes, and calls `span.end()`
- **THEN** the span appears in the EDOT backend

#### Scenario: User creates nested spans
- **WHEN** the user taps a "Nested Spans" button
- **THEN** the app creates a parent span, uses `withSpanContext()` to create a child span
- **THEN** both spans appear in the EDOT backend with parent-child relationship

### Requirement: Metrics demo
The basic example SHALL demonstrate Counter, Histogram, and UpDownCounter using `getMeterProvider()`.

#### Scenario: User records metrics
- **WHEN** the user taps metric buttons (counter, histogram, updown)
- **THEN** the app calls `counter.add()`, `histogram.record()`, and `upDownCounter.add()` with sample attributes
- **THEN** metrics appear in the EDOT backend

### Requirement: Structured logs demo
The basic example SHALL demonstrate `EdotReactNative.log()` with different severity levels.

#### Scenario: User emits structured logs
- **WHEN** the user taps log buttons (info, warn, error)
- **THEN** the app calls `EdotReactNative.log()` with the selected severity and sample attributes

### Requirement: Network request tracing demo
All examples SHALL demonstrate automatic network span creation by making `fetch()` calls to a public API endpoint. The SDK auto-instruments fetch — no manual span creation is needed.

#### Scenario: Successful fetch traced
- **WHEN** the user taps a "Fetch Data" button
- **THEN** the app calls `fetch('https://jsonplaceholder.typicode.com/posts/1')`
- **THEN** the SDK automatically creates an HTTP span with `http.method`, `http.url`, and `http.status_code` attributes
- **THEN** the response data is displayed on screen

#### Scenario: Failed fetch traced
- **WHEN** the user taps a "Fetch Error" button
- **THEN** the app calls `fetch()` to an invalid endpoint
- **THEN** the SDK creates an HTTP span with error status and records the exception

#### Scenario: Multiple sequential requests
- **WHEN** the user taps a "Fetch Multiple" button
- **THEN** the app makes 3 sequential fetch requests to different endpoints
- **THEN** each request produces a separate HTTP span in the EDOT backend

#### Scenario: XHR request traced
- **WHEN** the user taps a "XHR Request" button
- **THEN** the app makes a request using `XMLHttpRequest`
- **THEN** the SDK automatically creates an HTTP span identical to the fetch instrumentation

### Requirement: Error tracing demo
All examples SHALL demonstrate error tracing on both the JS side and the native side, showing how the SDK captures and reports errors.

#### Scenario: Uncaught JS exception traced
- **WHEN** the user taps a "Throw JS Error" button
- **THEN** the app throws an uncaught JS exception
- **THEN** the SDK's global error handler captures it and reports an error span with `exception.type`, `exception.message`, and `exception.stacktrace` attributes

#### Scenario: Unhandled Promise rejection traced
- **WHEN** the user taps a "Reject Promise" button
- **THEN** the app creates an unhandled Promise rejection
- **THEN** the SDK's promise rejection handler captures it and reports a `js_promise_rejection` error span

#### Scenario: React render error traced via ErrorBoundary
- **WHEN** the user triggers a render error inside an `EdotErrorBoundary`
- **THEN** the error boundary catches it, shows fallback UI, and reports the error to the EDOT backend

#### Scenario: Native crash traced
- **WHEN** the user taps a "Trigger Native Crash" button
- **THEN** the app calls a native method that throws an exception (e.g., force a null pointer or assertion failure)
- **THEN** on the next app launch, the native EDOT agent reports the crash to the backend

### Requirement: User interaction tracking demo
The basic example SHALL demonstrate `withEdotTracking` HOC and `useEdotAction` hook.

#### Scenario: Tracked button press
- **WHEN** the user taps a button wrapped with `withEdotTracking`
- **THEN** a user action event is emitted to the EDOT backend
