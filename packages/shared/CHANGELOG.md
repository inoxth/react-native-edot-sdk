# @inoxth/react-native-edot-shared

## 0.2.3

## 0.2.2

## 0.2.1

## 0.2.0

### Minor Changes

- aba9dee: Downgrade the native EDOT agents to support **iOS 15.6** and stock React Native 0.81 (Kotlin 2.1.20).

  - **iOS:** `apm-agent-ios` 2.x → **1.2.1**, OpenTelemetry-Swift → **1.13.0**; pod deployment target lowered **16.0 → 15.6**.
  - **Android:** `co.elastic.otel.android:agent-sdk` 1.5.0 → **1.1.0**, `io.opentelemetry:opentelemetry-api` 1.60.1 → **1.51.0**. This resolves the `kotlin-stdlib` to **2.1.20** (1.5.0 forced `2.3.0`, which the stock RN 0.81 Kotlin 2.1.20 compiler cannot read — an internal compiler error on install).

  ### ⚠️ Breaking changes

  These public APIs and config options are **removed** (the downgraded iOS agent has no span-attribute interceptor and the older agents lack the corresponding builder APIs):

  - **User / session / global attributes** — `setUser`, `clearUser`, `setSessionAttribute`, `setGlobalAttribute`, `removeGlobalAttribute`, and the `userAttributes` / `globalAttributes` config options.
  - **Attribute redaction** — the `attributeRedactions` config (`spans` / `logs` with `drop` / `dropPattern` / `mask` / `maskPattern`).
  - **Central config** — the `managementUrl`, `ios.useOpAMP`, and `ios.remoteManagement` config options.
  - **iOS persistence** — the `ios.persistencePreset` option is removed (it had no effect on apm-agent-ios 1.2.1).
  - **Metrics** — `recordMetric` attributes are now **string-only on both platforms** (`Record<string, string>` in the tracer-provider meter API); numeric/boolean metric dimensions are no longer supported (iOS 1.2.1's legacy meter is string-only, and aligning avoids the same call producing mixed-typed metric series). The custom iOS metrics pipeline (resource-aware MeterProvider + central-config gate) was removed; `recordMetric` now uses the agent's global MeterProvider. `application.launch.time`, `system.cpu.usage`, and `system.memory.usage` are emitted by apm-agent-ios 1.2.1's **built-in** instrumentation (same names + `state=app` as Android), so they remain **cross-platform** — `enableAppMetricInstrumentation` and `enableSystemMetrics` toggle them on both platforms.

  ### Migration

  Delete any calls to the removed methods and any of the removed config keys — there is no replacement; they are simply no longer part of the API.

  ### `READ_PHONE_STATE` (Android)

  `agent-sdk` 1.1.0 declares the `READ_PHONE_STATE` "dangerous" permission in its manifest (used only for an optional cellular network-subtype attribute; the agent runtime-guards it, so it is crash-safe when ungranted). Upstream removed it in `agent-sdk` 1.3.1. To strip it from your merged manifest:

  ```xml
  <uses-permission android:name="android.permission.READ_PHONE_STATE" tools:node="remove" />
  ```

  ### Retained (unchanged)

  Traces, auto-instrumented `fetch`/XHR, JS error/crash reporting, navigation spans, startup tracing, structured logs, `recordMetric`, sessions, `setTrackingConsent`, `urlSanitizer`, `ignoreSpanNames` / `ignoreLogPatterns`, and the cross-platform `application.launch.time` / `system.cpu.usage` / `system.memory.usage` native metrics.

## 0.1.2

### Patch Changes

- 1307141: ci: bump deprecated GitHub Actions to Node 24 supporting versions

  No runtime or API changes. Pure CI tooling update so the release
  pipeline keeps working past GitHub's 2026-06-02 Node 24 default
  cutover. Also doubles as the first end-to-end validation of the
  Trusted Publishing + OIDC + provenance attestation flow.

## 0.1.1

### Patch Changes

- chore: republish under @inoxth scope after 0.1.0 unpublish

## 0.1.0

### Minor Changes

- 60ae271: Initial public release of the React Native EDOT SDK — OpenTelemetry-compliant observability wrapping the native EDOT iOS / Android agents. Includes auto-instrumentation for fetch and XHR (with HTTP, GraphQL, and screen-correlation attributes), JS errors emitted as OTel exception events / crash events, app startup and app-state lifecycle, and a unified navigation integration covering `@react-navigation/native`, `expo-router`, and Wix `react-native-navigation`. Ships an iOS Swift module driven by `apm-agent-ios` via SPM (RN 0.75+ `spm_dependency` helper) and an Android Kotlin module driven by `apm-agent-android` v1.5.0, both supporting Old Architecture and New Architecture from a single codebase.
