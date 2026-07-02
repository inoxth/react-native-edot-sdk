# @inoxth/react-native-edot-tracer-provider

## 0.2.1

### Patch Changes

- Updated dependencies [7f9e2ba]
- Updated dependencies [4d35b32]
- Updated dependencies [82c8990]
  - @inoxth/react-native-edot-sdk@0.2.1
  - @inoxth/react-native-edot-shared@0.2.1

## 0.2.0

### Minor Changes

- aba9dee: **Breaking:** metric attributes are now **string-only**. `Counter.add`, `Histogram.record`, and `UpDownCounter.add` take `Record<string, string>` instead of `Record<string, string | number | boolean>`. iOS apm-agent-ios 1.2.1's legacy meter supports only string labels, and aligning both platforms avoids the same call producing mixed-typed metric series. Span attributes (`SpanOptions` / `Span.setAttribute`) are unchanged.

  Released in lockstep at **0.2.0** with the rest of the suite.

  Migration: convert numeric/boolean metric-attribute values to strings (e.g. `counter.add(1, { count: String(n) })`).

### Patch Changes

- Updated dependencies [aba9dee]
  - @inoxth/react-native-edot-sdk@0.2.0
  - @inoxth/react-native-edot-shared@0.2.0

## 0.1.2

### Patch Changes

- 1307141: ci: bump deprecated GitHub Actions to Node 24 supporting versions

  No runtime or API changes. Pure CI tooling update so the release
  pipeline keeps working past GitHub's 2026-06-02 Node 24 default
  cutover. Also doubles as the first end-to-end validation of the
  Trusted Publishing + OIDC + provenance attestation flow.

- Updated dependencies [1307141]
  - @inoxth/react-native-edot-shared@0.1.2
  - @inoxth/react-native-edot-sdk@0.1.2

## 0.1.1

### Patch Changes

- chore: republish under @inoxth scope after 0.1.0 unpublish
- Updated dependencies
  - @inoxth/react-native-edot-sdk@0.1.1
  - @inoxth/react-native-edot-shared@0.1.1

## 0.1.0

### Minor Changes

- 60ae271: Initial public release of the React Native EDOT SDK — OpenTelemetry-compliant observability wrapping the native EDOT iOS / Android agents. Includes auto-instrumentation for fetch and XHR (with HTTP, GraphQL, and screen-correlation attributes), JS errors emitted as OTel exception events / crash events, app startup and app-state lifecycle, and a unified navigation integration covering `@react-navigation/native`, `expo-router`, and Wix `react-native-navigation`. Ships an iOS Swift module driven by `apm-agent-ios` via SPM (RN 0.75+ `spm_dependency` helper) and an Android Kotlin module driven by `apm-agent-android` v1.5.0, both supporting Old Architecture and New Architecture from a single codebase.

### Patch Changes

- Updated dependencies [60ae271]
  - @inoxth/react-native-edot-shared@0.1.0
  - @inoxth/react-native-edot-sdk@0.1.0
