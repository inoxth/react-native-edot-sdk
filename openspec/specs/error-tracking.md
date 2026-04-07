# Error & Crash Tracking Specification

## Purpose
Capture JavaScript errors, unhandled promise rejections, React render errors,
and delegate native crash capture to EDOT native SDKs.

## Requirements

### JavaScript Errors
- MUST capture uncaught JS exceptions via `ErrorUtils.setGlobalHandler()`
- MUST capture unhandled promise rejections via Hermes rejection tracker
- MUST provide `EdotErrorBoundary` React component that catches render errors
- MUST record errors as OTel spans with attributes: `exception.type`, `exception.message`, `exception.stacktrace`, `error.source`
- MUST forward JS errors to native module for session-level crash correlation
- MUST distinguish fatal vs non-fatal errors (`isFatal` flag)

### Native Crashes
- MUST delegate native crash capture to EDOT native SDKs (PLCrashReporter on iOS, UncaughtExceptionHandler on Android)
- MUST ensure native agent is initialized before any user code runs
- SHALL NOT reimplement native crash capture in JS

### ANR Detection
- MUST enable EDOT Android SDK's ANR detection when `android.enableAnrDetection: true`
- This is a native-only feature; JS layer only controls the config toggle

### Error Resilience
- MUST wrap all SDK internal code in try-catch
- SDK errors MUST NEVER crash the host application
- SHOULD log internal errors only when `debug: true`

### Scenarios

#### Scenario: Uncaught JS exception
- **Given** the SDK is initialized with `instrumentJsErrors: true`
- **When** an uncaught TypeError occurs in user code
- **Then** a span with `error.source: js_uncaught` is created
- **And** the error is forwarded to the native module
- **And** the original React Native error handler is still called

#### Scenario: EdotErrorBoundary catches render error
- **Given** a component is wrapped in `<EdotErrorBoundary>`
- **When** a child component throws during render
- **Then** the error is recorded as a span with `error.source: js_render_error`
- **And** the fallback UI is rendered
- **And** the app does not crash