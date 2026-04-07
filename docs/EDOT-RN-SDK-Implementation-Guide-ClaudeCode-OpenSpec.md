# EDOT React Native SDK — Implementation Guide with Claude Code + OpenSpec

**Companion to:** `EDOT-React-Native-SDK-PRD.md`
**Date:** 2026-04-06
**Purpose:** Step-by-step instructions for building the EDOT React Native SDK using Claude Code as the AI coding agent and OpenSpec as the spec-driven development framework.

---

## Table of Contents

1. [Prerequisites & Environment Setup](#1-prerequisites--environment-setup)
2. [Project Initialization](#2-project-initialization)
3. [OpenSpec Configuration](#3-openspec-configuration)
4. [Writing the Base Specs (Current State)](#4-writing-the-base-specs)
5. [Phase 1 — Foundation](#5-phase-1--foundation)
6. [Phase 2 — Auto-Instrumentation](#6-phase-2--auto-instrumentation)
7. [Phase 3 — View-to-Network Span Correlation](#7-phase-3--view-to-network-span-correlation)
8. [Phase 4 — Navigation, Consent & Manual APIs](#8-phase-4--navigation-consent--manual-apis)
9. [Phase 5 — Symbolication, Migration & Polish](#9-phase-5--symbolication-migration--polish)
10. [Verification & Testing Workflow](#10-verification--testing-workflow)
11. [Tips & Troubleshooting](#11-tips--troubleshooting)

---

## 1. Prerequisites & Environment Setup

### 1.1 Install Required Tools

```bash
# Node.js 20.19.0+ (required by OpenSpec)
node --version  # verify ≥ 20.19.0

# Install OpenSpec globally
npm install -g @fission-ai/openspec@latest

# Verify
openspec --version

# Install Claude Code (if not already installed)
# See: https://docs.claude.com/en/docs/claude-code
npm install -g @anthropic-ai/claude-code

# React Native CLI + dependencies
npm install -g react-native-cli
# Ensure Xcode (iOS), Android Studio (Android), CocoaPods, and JDK 17 are installed
```

### 1.2 Create the Monorepo Root

```bash
mkdir edot-react-native-sdk && cd edot-react-native-sdk
git init
```

### 1.3 Copy the PRD into the Repo

Place the PRD document inside the repo so Claude Code can reference it:

```bash
mkdir -p docs
cp /path/to/EDOT-React-Native-SDK-PRD.md docs/PRD.md
```

---

## 2. Project Initialization

### 2.1 Initialize OpenSpec

```bash
openspec init
```

When prompted:
- **Primary AI tool**: Select `claude`
- **Profile**: Select `workflows` (expanded profile — we need granular control for a multi-phase SDK project)

This creates the `openspec/` directory structure:

```
edot-react-native-sdk/
├── openspec/
│   ├── config.yaml
│   ├── schemas/
│   ├── specs/          ← current system behavior (source of truth)
│   └── changes/        ← proposed modifications
├── docs/
│   └── PRD.md
└── .git/
```

### 2.2 Initialize the Monorepo Package Structure

Before OpenSpec specs, scaffold the empty monorepo so Claude Code has files to target:

```bash
# Initialize root package.json
npm init -y

# Create workspace directories
mkdir -p packages/core
mkdir -p packages/navigation
mkdir -p packages/wix-navigation
mkdir -p packages/expo-router
mkdir -p packages/tracer-provider
mkdir -p packages/cli
mkdir -p example
```

---

## 3. OpenSpec Configuration

### 3.1 Edit `openspec/config.yaml`

```yaml
schema: spec-driven
profile: workflows

tools:
  - claude

context:
  project_name: "EDOT React Native SDK"
  project_type: "React Native library (monorepo)"

  tech_stack:
    - TypeScript (strict mode)
    - React Native 0.72+ (both Bridge and New Architecture)
    - Swift 5.10+ (iOS native module)
    - Kotlin (Android native module)
    - Jest (unit testing)
    - Detox (E2E testing)
    - react-native-builder-bob (library build)
    - Yarn Workspaces (monorepo)
    - Changesets (versioning)

  conventions:
    file_structure: "monorepo with packages/ directory"
    testing_framework: "Jest for unit, Detox for E2E"
    code_style: "ESLint + Prettier, strict TypeScript"
    native_ios: "Swift with ObjC bridge headers"
    native_android: "Kotlin with ReactContextBaseJavaModule"
    build_tool: "react-native-builder-bob"

  dependencies:
    ios:
      - "ElasticApm ~> 2.0 (EDOT iOS SDK via SPM/CocoaPods)"
      - "opentelemetry-swift ~> 1.16.0 (transitive)"
      - "plcrashreporter ~> 1.12.0 (transitive)"
    android:
      - "co.elastic.otel.android:agent (EDOT Android SDK via Gradle)"
      - "co.elastic.otel.android:instrumentation-okhttp"
      - "io.opentelemetry:opentelemetry-api (transitive)"

  prd_location: "docs/PRD.md"

  api_style: "OpenTelemetry-aligned JavaScript API surface"

artifact_rules:
  proposal:
    max_length: "1500 words"
  specs:
    require_scenarios: true
    scenarios_per_requirement: 1
  tasks:
    max_per_phase: 15
    require_file_references: true
```

---

## 4. Writing the Base Specs

Since this is a **greenfield project** (building a new SDK from scratch), we write initial specs in `openspec/specs/` to establish the domain model. These become the source of truth that Claude Code uses as context.

### 4.1 Create Domain Specs

Run this in Claude Code:

```
/opsx:new base-sdk-specs
```

Then manually create (or ask Claude Code to create) the following spec files:

#### `openspec/specs/core-sdk.md`

```markdown
# Core SDK Specification

## Purpose
The EDOT React Native SDK provides a unified JavaScript/TypeScript API that wraps
the native EDOT iOS and EDOT Android SDKs to deliver OpenTelemetry-compliant
observability (traces, metrics, logs) for React Native applications.

## Requirements

### Initialization
- MUST provide an `EdotReactNative.initialize(config)` async method that starts the native EDOT agents
- MUST accept an `EdotConfig` TypeScript interface with required fields: `serverUrl`, `serviceName`, `serviceVersion`, `deploymentEnvironment`
- MUST support mutually exclusive authentication via `secretToken` OR `apiKey`
- MUST support optional native-side pre-initialization for crash capture before JS bundle loads
- MUST NOT start the native agent twice if `preInitialize` was already called natively
- MUST default `exportProtocol` to `'otlp/http'`
- MUST default `sessionSamplingRate` to `1.0`
- SHALL validate config at initialization and throw descriptive errors for invalid values
- SHOULD support `debug` flag that enables verbose console logging

### Platform Support
- MUST work on React Native 0.72 and above
- MUST support both Old Architecture (Bridge/NativeModules) and New Architecture (TurboModules/JSI)
- MUST detect architecture at runtime and load the appropriate native module
- MUST provide a no-op fallback if the native module is not linked (graceful degradation)

### Scenarios

#### Scenario: Successful initialization
- **Given** a valid EdotConfig with serverUrl, serviceName, serviceVersion, deploymentEnvironment
- **When** `EdotReactNative.initialize(config)` is called
- **Then** the native EDOT agent starts with the provided configuration
- **And** the promise resolves without error
- **And** `EdotReactNative.getCurrentSessionId()` returns a non-empty string

#### Scenario: Missing native module
- **Given** the native module is NOT linked (e.g., pod install was not run)
- **When** `EdotReactNative.initialize(config)` is called
- **Then** a warning is logged to console: "[EDOT] Native module not found..."
- **And** all subsequent API calls are no-ops (do not throw)
- **And** the host app does NOT crash

#### Scenario: Pre-initialization followed by JS initialization
- **Given** `EdotReactNativeAgent.preInitialize(...)` was called in AppDelegate/MainApplication
- **When** `EdotReactNative.initialize(config)` is called from JS
- **Then** the JS-specific config (network patching, error handling) is merged
- **And** the native agent is NOT restarted
```

#### `openspec/specs/network-instrumentation.md`

```markdown
# Network Instrumentation Specification

## Purpose
Automatically capture HTTP network requests initiated from the JavaScript thread
as OpenTelemetry spans with W3C trace context propagation.

## Requirements

### Auto-Instrumentation
- MUST monkey-patch `global.fetch` to create spans for all outgoing HTTP requests
- MUST monkey-patch `XMLHttpRequest` to create spans for all XHR-based requests (including Axios)
- MUST set span attributes following OpenTelemetry HTTP Semantic Conventions: `http.method`, `http.url`, `http.status_code`, `http.request_content_length`, `http.response_content_length`
- MUST set span status to ERROR for HTTP status codes >= 400
- MUST record exceptions on network failures (timeout, DNS error, etc.)
- MUST support `ignoreUrls` config to exclude matching URLs from instrumentation
- MUST NOT intercept requests to the EDOT server endpoint itself (prevent infinite loop)
- SHOULD strip query parameters from `http.url` attribute by default (PII protection)
- MAY accept a `urlSanitizer` callback for custom URL scrubbing

### Trace Context Propagation
- MUST inject W3C `traceparent` header into requests matching `tracePropagationTargets`
- MUST NOT inject headers into requests that do NOT match `tracePropagationTargets`
- MUST support both string and RegExp patterns in `tracePropagationTargets`

### Deduplication
- MUST set `X-Edot-RN-Traced: 1` header on JS-patched requests
- The native module MUST check for this header and skip creating a duplicate span

### GraphQL
- SHOULD extract `operationName` from request body for URLs matching `graphqlUrls`
- SHOULD use span name `GraphQL: {operationName}` when operation name is found

### Scenarios

#### Scenario: Fetch request creates span
- **Given** the SDK is initialized with `instrumentNetworkRequests: true`
- **When** `fetch('https://api.example.com/users')` is called
- **Then** a span named `HTTP GET` is created with `http.url: https://api.example.com/users`
- **And** the span ends when the response is received
- **And** `http.status_code` is set to the response status

#### Scenario: Axios request intercepted via XHR
- **Given** the SDK is initialized
- **When** `axios.get('https://api.example.com/users')` is called
- **Then** a span is created because Axios uses XMLHttpRequest internally
- **And** the span attributes match the same schema as fetch requests

#### Scenario: URL in ignoreUrls is skipped
- **Given** `ignoreUrls: [/\/health$/]` is configured
- **When** `fetch('https://api.example.com/health')` is called
- **Then** no span is created for this request

#### Scenario: Trace context propagation
- **Given** `tracePropagationTargets: [/api\.example\.com/]` is configured
- **When** `fetch('https://api.example.com/users')` is called
- **Then** the request includes a `traceparent` header in W3C format
```

#### `openspec/specs/error-tracking.md`

```markdown
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
```

#### `openspec/specs/navigation-tracking.md`

```markdown
# Navigation Tracking Specification

## Purpose
Track screen transitions as OpenTelemetry spans for each supported navigation library.

## Requirements

### General
- MUST create a span for each screen transition with attributes: `view.name`, `view.previous`, `view.transition_type`
- MUST end the previous view span when a new screen appears
- SHOULD accept a `screenNameMapper` callback to redact PII from screen names
- MUST be implemented as separate optional packages per navigation library

### React Navigation (@react-navigation/native)
- MUST provide `createEdotNavigationContainerRef()` that returns a ref + `onStateChange` handler
- MUST extract current route name via `navigationRef.getCurrentRoute()`

### Wix react-native-navigation
- MUST provide `registerEdotNavigationListener(Navigation)` that hooks into ComponentDidAppear events
- MUST extract component name from the event

### Expo Router
- MUST provide `<EdotExpoNavigationProvider>` wrapper component
- MUST use `usePathname()` and `useSegments()` hooks to detect route changes

### Scenarios

#### Scenario: React Navigation screen change
- **Given** the navigation container uses `createEdotNavigationContainerRef()`
- **When** user navigates from HomeScreen to ProductDetail
- **Then** the HomeScreen view span ends
- **And** a new span `Navigation: ProductDetail` is created
- **And** `view.previous` is set to `HomeScreen`
```

#### `openspec/specs/session-management.md`

```markdown
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
```

#### `openspec/specs/manual-instrumentation.md`

```markdown
# Manual Instrumentation Specification

## Purpose
Expose OpenTelemetry-aligned APIs for custom spans, metrics, and logs.

## Requirements

### TracerProvider
- MUST provide `getTracerProvider()` that returns an OTel-compatible TracerProvider
- MUST provide `getMeterProvider()` for custom metrics
- Tracer MUST support `startSpan(name, options)` with parent context
- MUST provide `withSpanContext(parentSpan, asyncFn)` helper for async context propagation

### Custom Spans
- MUST support `span.setAttribute(key, value)`
- MUST support `span.recordException(error)`
- MUST support `span.setStatus(statusCode)`
- MUST support `span.end()`
- MUST support nested parent-child spans

### Custom Metrics
- MUST support Counter, Histogram, and UpDownCounter metric types
- MUST support metric attributes

### Custom Logs
- MUST provide `EdotReactNative.log(severity, message, attributes)`
- MUST support severity levels: trace, debug, info, warn, error, fatal

### Orphaned Span Cleanup
- MUST run periodic cleanup (every 60s) to end spans older than 5 minutes
- MUST end orphaned spans with status `DEADLINE_EXCEEDED`

### Scenarios

#### Scenario: Custom span for business logic
- **Given** a tracer is obtained via `getTracerProvider().getTracer('checkout')`
- **When** `tracer.startSpan('processPayment')` is called
- **And** `span.setAttribute('payment.method', 'credit_card')` is called
- **And** `span.end()` is called
- **Then** the span is exported with the correct name and attributes
```

### 4.2 Validate Specs

```bash
openspec validate
```

Ensure no structural errors. Fix any warnings.

---

## 5. Phase 1 — Foundation (Weeks 1–3)

This phase builds the monorepo skeleton, native modules, and the core `initialize()` API.

### Step 5.1: Propose the Change

In Claude Code, run:

```
/opsx:propose phase1-foundation
```

Claude Code will read your specs and PRD, then generate:
- `openspec/changes/phase1-foundation/proposal.md`
- `openspec/changes/phase1-foundation/specs/` (delta specs)
- `openspec/changes/phase1-foundation/design.md`
- `openspec/changes/phase1-foundation/tasks.md`

### Step 5.2: Review & Refine the Tasks

Open `openspec/changes/phase1-foundation/tasks.md` and verify it includes these work items (adjust as needed):

```markdown
# Phase 1: Foundation — Implementation Tasks

## 1. Monorepo Scaffolding
- [ ] 1.1 Configure root `package.json` with Yarn Workspaces pointing to `packages/*` and `example`
- [ ] 1.2 Set up TypeScript project references (`tsconfig.json` root + per-package)
- [ ] 1.3 Configure `react-native-builder-bob` in each package for CommonJS + ESM + types output
- [ ] 1.4 Set up ESLint + Prettier with shared config at root
- [ ] 1.5 Add Changesets config for version management (`changeset init`)
- [ ] 1.6 Create GitHub Actions CI workflow (lint, typecheck, build)

## 2. Core Package — JS Layer (`packages/core`)
- [ ] 2.1 Create `packages/core/package.json` with `@inox-edot/react-native` name and bob config
- [ ] 2.2 Define `EdotConfig` TypeScript interface (all fields from PRD Section 3.1.3)
- [ ] 2.3 Implement config validation with descriptive error messages
- [ ] 2.4 Implement native module loader with TurboModule detection and no-op fallback
  - File: `packages/core/src/nativeModule.ts`
- [ ] 2.5 Implement `EdotReactNative.initialize()` that calls native module with validated config
  - File: `packages/core/src/EdotReactNative.ts`
- [ ] 2.6 Implement session API: `getCurrentSessionId()`, `setUser()`, `clearUser()`, `setSessionAttribute()`
- [ ] 2.7 Implement global attribute API: `setGlobalAttribute()`, `removeGlobalAttribute()`
- [ ] 2.8 Export all public types and APIs from `packages/core/src/index.ts`

## 3. Core Package — iOS Native Module (`packages/core/ios`)
- [ ] 3.1 Create `EdotReactNative.podspec` with dependency on `ElasticApm ~> 2.0` and `React-Core`
- [ ] 3.2 Implement `EdotReactNative.swift` native module with all bridge methods (PRD Section 4.1.3)
- [ ] 3.3 Implement `EdotReactNative.m` ObjC bridge header for Old Architecture
- [ ] 3.4 Implement `EdotReactNativeAgent.swift` for native pre-initialization API
- [ ] 3.5 Implement `EdotBridgeHelpers.swift` for NSDictionary ↔ Swift type conversions
- [ ] 3.6 Define TurboModule codegen spec (`EdotReactNativeSpec.h`) for New Architecture

## 4. Core Package — Android Native Module (`packages/core/android`)
- [ ] 4.1 Create `build.gradle.kts` with dependency on EDOT Android SDK and react-android
- [ ] 4.2 Implement `EdotReactNativeModule.kt` with all bridge methods (PRD Section 4.2.3)
- [ ] 4.3 Implement `EdotReactNativePackage.kt` for RN module registration
- [ ] 4.4 Implement `EdotReactNativeAgent.kt` for native pre-initialization API
- [ ] 4.5 Implement `EdotBridgeHelpers.kt` for ReadableMap ↔ Kotlin type conversions
- [ ] 4.6 Implement `EdotTurboModule.kt` for New Architecture support
- [ ] 4.7 Create `AndroidManifest.xml` with required permissions

## 5. TurboModule Spec (Shared)
- [ ] 5.1 Create `packages/core/src/NativeEdotReactNative.ts` TurboModule spec (PRD Section 4.3)
- [ ] 5.2 Verify codegen output compiles on both iOS and Android

## 6. Example App
- [ ] 6.1 Create `example/` React Native app with `npx react-native init EdotExample`
- [ ] 6.2 Link core package via workspace resolution
- [ ] 6.3 Add initialization code in `example/index.js` with sample config
- [ ] 6.4 Verify app builds and runs on iOS Simulator and Android Emulator
- [ ] 6.5 Verify `getCurrentSessionId()` returns a valid ID after init

## 7. Unit Tests
- [ ] 7.1 Add Jest config at root with module name mapper for packages
- [ ] 7.2 Write tests for config validation (valid config, missing fields, invalid values)
- [ ] 7.3 Write tests for native module loader (TurboModule available, fallback to NativeModules, no-op fallback)
- [ ] 7.4 Write tests for `EdotReactNative` public API surface (mock native module)
```

### Step 5.3: Apply the Tasks

Once tasks are reviewed and refined:

```
/opsx:apply
```

Claude Code will implement each task sequentially, marking checkboxes as it goes. Monitor the progress and provide guidance when Claude Code asks questions.

**Key guidance to give Claude Code during Phase 1:**

- "Reference docs/PRD.md Section 3.1.3 for the full EdotConfig interface"
- "Reference docs/PRD.md Section 4.1 for iOS native module implementation"
- "Reference docs/PRD.md Section 4.2 for Android native module implementation"
- "Reference docs/PRD.md Section 4.3 for TurboModule spec"
- "Use `react-native-builder-bob` create-library template as starting point for package scaffolding"

### Step 5.4: Verify & Archive

```bash
# Validate implementation matches specs
openspec validate

# Run tests
yarn test

# Build all packages
yarn build

# Run example app
cd example && npx react-native run-ios
cd example && npx react-native run-android
```

If everything passes:

```
/opsx:archive phase1-foundation
```

This merges delta specs into `openspec/specs/` and archives the change.

---

## 6. Phase 2 — Auto-Instrumentation (Weeks 4–6)

### Step 6.1: Propose

```
/opsx:propose phase2-auto-instrumentation
```

Provide this context to Claude Code:

> Implement auto-instrumentation features: fetch/XHR monkey-patching with OTel spans,
> W3C trace context propagation, GraphQL operation name extraction, URL sanitization,
> JS error handling (global errors + promise rejections + EdotErrorBoundary),
> AppState lifecycle tracking, app startup tracing, deduplication of JS vs native network spans,
> orphaned span cleanup timer, and graceful degradation.
> Reference docs/PRD.md Sections 3.2, 3.4, 3.5, 3.12, 3.13, 3.16, 3.17.

### Step 6.2: Expected Tasks (guide Claude Code)

```markdown
# Phase 2: Auto-Instrumentation — Implementation Tasks

## 1. Network Instrumentation
- [ ] 1.1 Implement fetch monkey-patch in `packages/core/src/instrumentation/fetchPatch.ts`
  - Save reference to `global.fetch`, replace with instrumented version
  - Create OTel spans with HTTP semantic convention attributes
  - Set `X-Edot-RN-Traced: 1` header for deduplication
- [ ] 1.2 Implement XMLHttpRequest monkey-patch in `packages/core/src/instrumentation/xhrPatch.ts`
  - Intercept `open()`, `send()`, and response event listeners
  - Same span attributes as fetch
- [ ] 1.3 Implement URL sanitizer in `packages/core/src/utils/urlSanitizer.ts`
  - Default: strip query parameters
  - Accept custom `urlSanitizer` callback from config
- [ ] 1.4 Implement `ignoreUrls` matching logic
  - Support string and RegExp patterns
  - Always ignore the SDK's own serverUrl
- [ ] 1.5 Implement W3C `traceparent` header injection for `tracePropagationTargets`
  - File: `packages/core/src/instrumentation/traceContextPropagator.ts`
- [ ] 1.6 Implement GraphQL operation name extraction for `graphqlUrls`
  - Parse request body JSON, extract `operationName`
  - Override span name to `GraphQL: {operationName}`
- [ ] 1.7 Implement header capture allowlist (`requestHeadersToCapture`, `responseHeadersToCapture`)
- [ ] 1.8 Write unit tests for fetch patch, XHR patch, URL sanitizer, trace propagation, GraphQL extraction

## 2. Error Tracking
- [ ] 2.1 Implement global JS error handler in `packages/core/src/instrumentation/errorHandler.ts`
  - Use `ErrorUtils.setGlobalHandler()` — chain with existing handler
- [ ] 2.2 Implement promise rejection tracker
  - Hermes: `global.HermesInternal?.enablePromiseRejectionTracker()`
  - JSC fallback: `require('promise/setimmediate/rejection-tracking')`
- [ ] 2.3 Implement `EdotErrorBoundary` React component
  - File: `packages/core/src/components/EdotErrorBoundary.tsx`
  - Accept `fallback` prop, `onError` callback
- [ ] 2.4 Implement `reportJsError()` internal function that creates span + forwards to native
- [ ] 2.5 Write unit tests for error handler, promise tracker, ErrorBoundary

## 3. Lifecycle & Startup
- [ ] 3.1 Implement AppState lifecycle tracker in `packages/core/src/instrumentation/lifecycleTracker.ts`
  - Listen to AppState changes, create spans for foreground/background/inactive
- [ ] 3.2 Implement app startup tracing
  - Native side: record `nativeStartTimestamp` in preInitialize
  - JS side: record `jsBundleLoadedTimestamp` in initialize()
  - Create `AppStartup` span with child spans
- [ ] 3.3 Implement iOS background flush via `beginBackgroundTask` (native module)
- [ ] 3.4 Write unit tests for lifecycle tracker

## 4. Span Management
- [ ] 4.1 Implement span registry in `packages/core/src/spans/SpanRegistry.ts`
  - JS-side Map<spanId, { startTime, span }>
- [ ] 4.2 Implement orphaned span cleanup timer (60s interval, 5min timeout)
  - End expired spans with DEADLINE_EXCEEDED
- [ ] 4.3 Implement native-side concurrent span registry
  - iOS: NSLock-protected dictionary
  - Android: ConcurrentHashMap
- [ ] 4.4 Write unit tests for span registry and cleanup

## 5. Integration Test
- [ ] 5.1 Update example app to demonstrate: fetch request → span in console (debug mode)
- [ ] 5.2 Trigger a JS error and verify it appears in debug console output
- [ ] 5.3 Verify lifecycle spans fire on app foreground/background
```

### Step 6.3: Apply & Verify

```
/opsx:apply
```

After implementation:

```bash
yarn test
yarn build
cd example && npx react-native run-ios  # verify fetch spans appear in debug console
```

```
/opsx:archive phase2-auto-instrumentation
```

---

## 7. Phase 3 — View-to-Network Span Correlation (Week 7)

This is a dedicated phase for the screen-to-API correlation system. It sits between auto-instrumentation and navigation because it needs the network interceptor from Phase 2 to be working, and it establishes the `ActiveViewContext` contract that the navigation plugins in Phase 4 will consume.

### Step 7.1: Propose

```
/opsx:propose phase3-view-network-correlation
```

Provide this context to Claude Code:

> Implement the View-to-Network span correlation system that automatically links
> every network span, error span, and custom span to the screen (view span) that
> was active when it fired. This uses OTel span links (not parent-child) so view
> and network spans have independent lifetimes.
> Reference docs/PRD.md Section 3.19.

### Step 7.2: Review OpenSpec Spec

Before tasks, ensure the following spec is in `openspec/specs/`:

#### `openspec/specs/view-network-correlation.md`

```markdown
# View-to-Network Span Correlation Specification

## Purpose
Automatically link every network span, JS error span, and custom span to the
navigation view (screen) that was active when it was created, enabling "which
APIs does this screen call?" queries in Kibana.

## Requirements

### Active View Context
- MUST maintain a module-level `ActiveViewContext` that holds the current view span's SpanContext and view name
- MUST provide `setActiveView(spanContext, viewName)` for navigation plugins to call on screen change
- MUST atomically replace the context (no clearing between screens)
- MUST be accessible from the network interceptor, error handler, and TracerProvider wrapper
- MUST default to `null` before the first screen renders

### Network Span Enrichment
- MUST add `view.name` attribute to every network span when an active view exists
- MUST add `view.id` attribute (the view span's spanId) to every network span
- MUST add an OTel span link from every network span to the active view span context
- MUST NOT use parent-child relationship (to allow independent span lifetimes)
- MUST gracefully handle the case where no active view exists (first app load, before navigation init)

### Error Span Enrichment
- MUST add `view.name` attribute to every JS error span
- MUST add span link to the active view span
- This enables "which screen has the most errors?" queries

### Custom Span Enrichment
- MUST auto-link custom spans (from TracerProvider) to the active view span by default
- SHOULD allow opt-out via a `autoLinkToActiveView: false` option on startSpan
- MUST add `view.name` as attribute on auto-linked custom spans

### Scenarios

#### Scenario: Fetch on ProductDetailScreen is linked to view
- **Given** the user is on `ProductDetailScreen` (view span is active)
- **When** `fetch('https://api.example.com/products/123')` is called
- **Then** the network span has attribute `view.name: ProductDetailScreen`
- **And** the network span has attribute `view.id: {spanId of view span}`
- **And** the network span has a span link to the view span context

#### Scenario: API still in-flight when user navigates away
- **Given** `fetch('/api/slow-endpoint')` was called on `ScreenA`
- **When** the user navigates to `ScreenB` before the response arrives
- **Then** the `ScreenA` view span ends immediately on navigation
- **And** the network span continues until the response arrives
- **And** the network span still has `view.name: ScreenA` (captured at creation time)

#### Scenario: No active view (app startup before first screen)
- **Given** the SDK is initialized but no navigation plugin has rendered yet
- **When** `fetch('https://api.example.com/config')` is called
- **Then** the network span is created WITHOUT `view.name` or `view.id`
- **And** the network span has no span links
- **And** no error is thrown

#### Scenario: JS error linked to active screen
- **Given** the user is on `CheckoutScreen`
- **When** an uncaught TypeError occurs
- **Then** the error span has attribute `view.name: CheckoutScreen`
- **And** the error span has a span link to the CheckoutScreen view span

#### Scenario: Custom span auto-linked to active view
- **Given** the user is on `CartScreen`
- **When** `tracer.startSpan('calculateTotal')` is called
- **Then** the custom span has `view.name: CartScreen`
- **And** the custom span has a span link to the CartScreen view span

#### Scenario: Custom span opts out of auto-linking
- **Given** the user is on `CartScreen`
- **When** `tracer.startSpan('backgroundSync', { autoLinkToActiveView: false })` is called
- **Then** the custom span does NOT have `view.name` or span link attributes
```

### Step 7.3: Expected Tasks

```markdown
# Phase 3: View-to-Network Span Correlation — Implementation Tasks

## 1. Active View Context Module
- [ ] 1.1 Create `packages/core/src/context/ActiveViewContext.ts`
  - Export: `setActiveView(spanContext, viewName)`, `clearActiveView()`, `getActiveViewContext()`, `getActiveViewName()`
  - Module-level variables (singleton pattern)
  - Atomic replacement on `setActiveView()` (no intermediate null state)
- [ ] 1.2 Write unit tests for ActiveViewContext
  - Test: set → get returns correct values
  - Test: set new view replaces old view atomically
  - Test: get before any set returns null
  - Test: clearActiveView resets to null

## 2. Network Interceptor Integration
- [ ] 2.1 Update `packages/core/src/instrumentation/fetchPatch.ts`
  - Import `getActiveViewContext()` and `getActiveViewName()`
  - Add `view.name` and `view.id` attributes to every network span when available
  - Add span link to `activeViewContext` when available
  - Capture view context at span creation time (not at span end)
- [ ] 2.2 Update `packages/core/src/instrumentation/xhrPatch.ts` with same enrichment
- [ ] 2.3 Write unit tests
  - Test: network span has view.name when active view exists
  - Test: network span has NO view.name when no active view
  - Test: view.name is captured at creation, not at response time (simulate navigation during request)

## 3. Error Handler Integration
- [ ] 3.1 Update `packages/core/src/instrumentation/errorHandler.ts`
  - Add `view.name` attribute and span link to all error spans
- [ ] 3.2 Update `EdotErrorBoundary` component to include view context on render errors
- [ ] 3.3 Write unit tests for error-to-view correlation

## 4. TracerProvider Integration
- [ ] 4.1 Update `packages/tracer-provider/src/TracerWrapper.ts` (or create if not yet built)
  - Override `startSpan()` to auto-inject `view.name` + span link
  - Respect `autoLinkToActiveView: false` option to skip
- [ ] 4.2 Write unit tests
  - Test: custom span auto-linked when active view exists
  - Test: custom span NOT linked when `autoLinkToActiveView: false`
  - Test: custom span NOT linked when no active view

## 5. Contract for Navigation Plugins
- [ ] 5.1 Export `setActiveView` and `getActiveViewContext` from core package's public API
  - Add to `packages/core/src/index.ts` exports
  - These are consumed by navigation plugin packages in Phase 4
- [ ] 5.2 Document the contract in TSDoc comments:
  - Navigation plugins MUST call `setActiveView(spanContext, viewName)` when a new screen appears
  - Navigation plugins MUST NOT call `clearActiveView()` between screens (atomic swap only)

## 6. Integration Verification
- [ ] 6.1 Create a temporary test harness in the example app
  - Manually call `setActiveView()` with a mock view context
  - Trigger a fetch request
  - Verify in debug console that the span includes `view.name` and `view.id`
- [ ] 6.2 Trigger a JS error while mock view is active
  - Verify error span includes `view.name`
```

### Step 7.4: Apply & Verify

```
/opsx:apply
```

After implementation:

```bash
yarn test
yarn build
cd example && npx react-native run-ios  # verify view.name appears on fetch spans in debug console
```

```
/opsx:verify
```

Claude Code validates each Given/When/Then scenario against the implementation.

```
/opsx:archive phase3-view-network-correlation
```

---

## 8. Phase 4 — Navigation, Consent & Manual APIs (Weeks 8–10)

This phase builds all navigation plugins, the consent system, user interaction tracking, and manual instrumentation APIs. Critically, each navigation plugin now calls `setActiveView()` from Phase 3's `ActiveViewContext` module — which means every screen transition automatically starts correlating network/error/custom spans to the new screen.

### Step 8.1: Propose

```
/opsx:propose phase4-navigation-consent-manual-apis
```

Context for Claude Code:

> Implement navigation tracking plugins (React Navigation, Wix, Expo Router),
> tracking consent API (granted/pending/not_granted), user interaction tracking,
> manual instrumentation API (TracerProvider, custom spans/metrics/logs, withSpanContext),
> and iOS background disk cache.
> IMPORTANT: Each navigation plugin MUST call `setActiveView(spanContext, viewName)`
> from `@inox-edot/react-native` core package when a new screen appears.
> This enables the view-to-network correlation built in Phase 3.
> Reference docs/PRD.md Sections 3.3, 3.6, 3.7, 3.10, 3.11, 3.14, 3.17.3, 3.19.

### Step 8.2: Expected Tasks

```markdown
# Phase 4: Navigation, Consent & Manual APIs — Implementation Tasks

## 1. React Navigation Plugin (`packages/navigation`)
- [ ] 1.1 Create package scaffolding with bob config
- [ ] 1.2 Implement `createEdotNavigationContainerRef()` in `src/index.ts`
  - Return ref + onStateChange handler
  - Extract route name via `getCurrentRoute()`
  - Create view spans on route change, end previous span
  - **Call `setActiveView(newViewSpanContext, routeName)` on every screen change**
- [ ] 1.3 Implement `screenNameMapper` callback support
- [ ] 1.4 Add `@react-navigation/native` and `@inox-edot/react-native` as peer dependencies
- [ ] 1.5 Write unit tests with mocked navigation state
  - **Test: verify `setActiveView()` is called with correct spanContext and view name**

## 2. Wix Navigation Plugin (`packages/wix-navigation`)
- [ ] 2.1 Create package scaffolding
- [ ] 2.2 Implement `registerEdotNavigationListener(Navigation)` using ComponentDidAppear events
  - **Call `setActiveView(spanContext, componentName)` on each ComponentDidAppear**
- [ ] 2.3 Add `react-native-navigation` and `@inox-edot/react-native` as peer dependencies
- [ ] 2.4 Write unit tests with mocked Wix Navigation events
  - **Test: verify `setActiveView()` is called on ComponentDidAppear**

## 3. Expo Router Plugin (`packages/expo-router`)
- [ ] 3.1 Create package scaffolding
- [ ] 3.2 Implement `<EdotExpoNavigationProvider>` using `usePathname()` / `useSegments()`
  - **Call `setActiveView(spanContext, pathname)` when pathname changes**
- [ ] 3.3 Add `expo-router` and `@inox-edot/react-native` as peer dependencies
- [ ] 3.4 Write unit tests with mocked Expo Router hooks
  - **Test: verify `setActiveView()` is called when pathname changes**

## 4. Tracking Consent
- [ ] 4.1 Implement consent state machine in `packages/core/src/consent/ConsentManager.ts`
  - States: granted, pending, not_granted
  - Buffer management: hold, flush, purge
- [ ] 4.2 Implement `setTrackingConsent()` public API
- [ ] 4.3 Wire consent state into all instrumentation hooks (stop collection when not_granted)
- [ ] 4.4 Implement native-side consent buffer (iOS in-memory + Android disk)
- [ ] 4.5 Write unit tests for consent state transitions

## 5. User Interaction Tracking
- [ ] 5.1 Implement `EdotReactNative.addAction(type, name, attributes)` API
- [ ] 5.2 Implement `withEdotTracking(Component, options)` HOC
- [ ] 5.3 Implement `useEdotAction()` hook
- [ ] 5.4 Write unit tests for action tracking

## 6. TracerProvider Package (`packages/tracer-provider`)
- [ ] 6.1 Create package scaffolding
- [ ] 6.2 Implement `getTracerProvider()` that wraps native EDOT TracerProvider
  - Returns OTel-compatible TracerProvider interface
- [ ] 6.3 Implement `getMeterProvider()` for custom metrics
- [ ] 6.4 Implement `withSpanContext(parentSpan, asyncFn)` async context helper
- [ ] 6.5 Implement custom span API: startSpan, setAttribute, recordException, setStatus, end
- [ ] 6.6 Implement custom metrics: Counter, Histogram, UpDownCounter
- [ ] 6.7 Implement `EdotReactNative.log(severity, message, attributes)` in core package
- [ ] 6.8 Write unit tests for tracer, meter, and log APIs

## 7. iOS Offline Resilience
- [ ] 7.1 Implement background flush in iOS native module (beginBackgroundTask)
- [ ] 7.2 Implement lightweight file-based disk cache for unsent telemetry on iOS
- [ ] 7.3 Implement cache read-and-flush on next app launch
- [ ] 7.4 Write XCTest for background flush behavior

## 8. Integration Test
- [ ] 8.1 Update example app with React Navigation tracking
- [ ] 8.2 Add consent toggle UI to example app
- [ ] 8.3 Add custom span example (checkout flow)
- [ ] 8.4 Verify navigation spans, consent behavior, custom spans in debug console
```

### Step 8.3: Apply & Verify

```
/opsx:apply
```

After implementation, verify the full view-to-API correlation chain works end-to-end:

```bash
yarn test
yarn build
cd example && npx react-native run-ios
```

**Critical verification**: Navigate between screens in the example app while debug mode is on. Every fetch span logged to console should now include `view.name: ScreenName`. If it doesn't, check that the navigation plugin is calling `setActiveView()`.

```
/opsx:archive phase4-navigation-consent-manual-apis
```

---

## 9. Phase 5 — Symbolication, Migration & Polish (Weeks 11–14)

### Step 9.1: Propose

```
/opsx:propose phase5-symbolication-migration-polish
```

Context:

> Implement the edot-rn-sourcemap-upload CLI tool (JS source maps, ProGuard mapping, iOS dSYM),
> CodePush/OTA version support, Expo config plugin, DataDog migration guide,
> debug console output, E2E tests with Detox, performance benchmarking, and documentation.
> Reference docs/PRD.md Sections 3.9, 3.15, 3.18, 5, 6, 7, 8.

### Step 9.2: Expected Tasks

```markdown
# Phase 5: Symbolication, Migration & Polish — Implementation Tasks

## 1. CLI Tool (`packages/cli`)
- [ ] 1.1 Create `packages/cli/package.json` with bin entry `edot-rn-sourcemap-upload`
- [ ] 1.2 Implement CLI argument parsing (--type, --server-url, --secret-token, --service-name, etc.)
- [ ] 1.3 Implement `sourcemap` upload type (POST to Elastic APM source map endpoint)
  - Support Hermes `.hbc.map` and Metro `.jsbundle.map` formats
- [ ] 1.4 Implement `proguard` upload type (POST mapping.txt)
- [ ] 1.5 Implement `dsym` upload type (POST dSYM directory)
- [ ] 1.6 Implement `--dry-run` mode
- [ ] 1.7 Implement CodePush composite version: `serviceVersion+codePushVersion`
- [ ] 1.8 Write unit tests for CLI argument parsing and upload logic (mock HTTP)

## 2. Expo Config Plugin
- [ ] 2.1 Create `plugin/` directory in `packages/core`
- [ ] 2.2 Implement iOS config plugin: modify AppDelegate.swift, add ElasticApm pod
- [ ] 2.3 Implement Android config plugin: add Gradle plugin, modify MainApplication.kt
- [ ] 2.4 Test with `npx expo prebuild` on a fresh Expo project

## 3. Debug Tooling
- [ ] 3.1 Implement debug console output formatter in `packages/core/src/debug/DebugLogger.ts`
  - Format: `[EDOT] Span started: HTTP GET ... (spanId: abc123)`
- [ ] 3.2 Implement `debugExportToConsole` — log OTLP payloads to console
- [ ] 3.3 Wire debug logger into all instrumentation hooks

## 4. Documentation
- [ ] 4.1 Write root `README.md` with quick start, installation, and configuration
- [ ] 4.2 Write `packages/core/README.md` with full API reference
- [ ] 4.3 Write `packages/navigation/README.md` with React Navigation setup guide
- [ ] 4.4 Write `packages/wix-navigation/README.md`
- [ ] 4.5 Write `packages/expo-router/README.md`
- [ ] 4.6 Write `packages/tracer-provider/README.md` with custom spans/metrics/logs examples
- [ ] 4.7 Write `packages/cli/README.md` with source map upload guide
- [ ] 4.8 Write `docs/MIGRATION-FROM-DATADOG.md` based on PRD Section 5
- [ ] 4.9 Write `docs/GDPR-COMPLIANCE.md` covering consent, PII scrubbing, data handling

## 5. E2E Testing
- [ ] 5.1 Set up Detox in `example/` app
- [ ] 5.2 Create mock OTLP server (simple Express app that records received spans)
- [ ] 5.3 Write E2E test: app init → fetch request → verify span received by mock server
- [ ] 5.4 Write E2E test: navigation → verify view span received
- [ ] 5.5 Write E2E test: JS error → verify error span received
- [ ] 5.6 Write E2E test: consent pending → no export; consent granted → flush

## 6. Performance Benchmarking
- [ ] 6.1 Measure SDK init time impact (baseline vs with SDK)
- [ ] 6.2 Measure runtime CPU overhead (instrumented vs non-instrumented fetch loop)
- [ ] 6.3 Measure memory overhead (snapshot heap before/after init)
- [ ] 6.4 Document results in `docs/PERFORMANCE.md`

## 7. Publish Pipeline
- [ ] 7.1 Configure Changesets for all packages
- [ ] 7.2 Add GitHub Actions release workflow: changeset version → npm publish
- [ ] 7.3 Test publish with `--dry-run` to verify package contents
- [ ] 7.4 Publish v0.1.0-beta.1 to npm
```

### Step 9.3: Apply & Verify

```
/opsx:apply
```

Full verification:

```bash
# Unit tests
yarn test

# Build all packages
yarn build

# E2E tests
cd example && npx detox build --configuration ios.sim.release
cd example && npx detox test --configuration ios.sim.release

# CLI dry run
npx edot-rn-sourcemap-upload --dry-run --type sourcemap ...

# Verify npm package contents
cd packages/core && npm pack --dry-run
```

```
/opsx:archive phase5-symbolication-migration-polish
```

---

## 10. Verification & Testing Workflow

### 10.1 After Every Phase — Run This Checklist

```bash
# 1. OpenSpec validation
openspec validate

# 2. TypeScript type check
yarn tsc --noEmit

# 3. Lint
yarn lint

# 4. Unit tests
yarn test --coverage

# 5. Build all packages
yarn build

# 6. iOS build (on macOS)
cd example/ios && pod install && cd ..
npx react-native run-ios

# 7. Android build
npx react-native run-android

# 8. (Phase 4+) E2E tests
npx detox test
```

### 10.2 OpenSpec Verify Command

After each `/opsx:apply`, run:

```
/opsx:verify
```

This checks that the implementation matches the spec scenarios. Claude Code will compare the Given/When/Then scenarios against the actual code behavior and flag mismatches.

### 10.3 Spec Sync

After archiving a phase, the delta specs merge into `openspec/specs/`. Always verify:

```bash
openspec list   # should show archived changes
openspec view   # interactive dashboard shows spec coverage
```

---

## 11. Tips & Troubleshooting

### 11.1 Claude Code Best Practices for This Project

**Give context on every `/opsx:propose`**: Always reference the PRD section numbers. Claude Code works best when it knows exactly which section of `docs/PRD.md` to read.

**Review tasks.md before `/opsx:apply`**: The tasks file is your contract with Claude Code. If a task is ambiguous, Claude Code will guess — and it may guess wrong. Sharpen task descriptions before applying.

**One phase at a time**: Don't try to `/opsx:propose` all phases at once. Each phase builds on the previous one's archived specs.

**Use `/opsx:continue` for refinement**: If a proposal needs iteration, use `/opsx:continue` to regenerate a specific artifact (e.g., just the tasks) without redoing the whole proposal.

**Pin native SDK versions**: In the design.md, explicitly state `ElasticApm ~> 2.0.0` (not `latest`). Claude Code should use exact or tilde-pinned versions.

### 11.2 Common Issues

**Issue: Native module not linking in example app**
- iOS: Run `cd example/ios && pod install --repo-update`
- Android: Run `cd example/android && ./gradlew clean`

**Issue: TurboModule codegen not generating**
- Ensure `codegenConfig` is set in `packages/core/package.json`
- Run `cd example && npx react-native codegen`

**Issue: Duplicate spans for the same network request**
- Verify `X-Edot-RN-Traced: 1` header is being set in fetch patch
- Verify native module checks for this header

**Issue: `openspec validate` fails after archive**
- Check that delta specs merged correctly into `openspec/specs/`
- Manually fix any merge conflicts in spec files

### 11.3 File Reference Map

Quick reference for where things live:

| Component | Location |
|---|---|
| PRD | `docs/PRD.md` |
| OpenSpec config | `openspec/config.yaml` |
| Base specs | `openspec/specs/*.md` |
| Change proposals | `openspec/changes/{phase-name}/` |
| Core JS package | `packages/core/src/` |
| iOS native module | `packages/core/ios/` |
| Android native module | `packages/core/android/` |
| React Nav plugin | `packages/navigation/src/` |
| Wix Nav plugin | `packages/wix-navigation/src/` |
| Expo Router plugin | `packages/expo-router/src/` |
| TracerProvider package | `packages/tracer-provider/src/` |
| CLI tool | `packages/cli/src/` |
| Example app | `example/` |
| E2E tests | `example/e2e/` |
| Migration guide | `docs/MIGRATION-FROM-DATADOG.md` |

### 11.4 OpenSpec Command Quick Reference

| Command | When to Use |
|---|---|
| `openspec init` | Once, at project start |
| `/opsx:propose <name>` | Start of each phase |
| `/opsx:apply` | After reviewing tasks.md |
| `/opsx:verify` | After apply completes |
| `/opsx:archive <name>` | After phase passes all tests |
| `openspec validate` | Anytime, to check spec integrity |
| `openspec list` | See all changes and their status |
| `openspec view` | Interactive dashboard |
| `/opsx:continue` | Regenerate a specific artifact |
| `/opsx:ff` | Fast-forward: create all artifacts at once |

---

## Summary: The Full Workflow at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    For Each Phase (1–5)                          │
│                                                                 │
│   1.  /opsx:propose phase-name                                  │
│       ↓ Claude Code generates: proposal, specs, design, tasks   │
│                                                                 │
│   2.  Review tasks.md — refine, add file references, reorder    │
│                                                                 │
│   3.  /opsx:apply                                               │
│       ↓ Claude Code implements each task, marks checkboxes      │
│                                                                 │
│   4.  /opsx:verify                                              │
│       ↓ Claude Code validates implementation vs specs           │
│                                                                 │
│   5.  Run: yarn test && yarn build && run example app           │
│                                                                 │
│   6.  /opsx:archive phase-name                                  │
│       ↓ Delta specs merge into openspec/specs/                  │
│                                                                 │
│   7.  git add . && git commit -m "Phase N: description"         │
│                                                                 │
│   → Proceed to next phase                                       │
└─────────────────────────────────────────────────────────────────┘
```

Total estimated duration: **14 weeks** (Phases 1–5, with Phase 3 adding 1 week for view-to-network correlation).
