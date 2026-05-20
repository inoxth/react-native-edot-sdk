---
"@inox/react-native-edot-shared": minor
"@inox/react-native-edot-sdk": minor
"@inox/react-native-edot-navigation": minor
"@inox/react-native-edot-tracer-provider": minor
---

Initial public release of the React Native EDOT SDK — OpenTelemetry-compliant observability wrapping the native EDOT iOS / Android agents. Includes auto-instrumentation for fetch and XHR (with HTTP, GraphQL, and screen-correlation attributes), JS errors emitted as OTel exception events / crash events, app startup and app-state lifecycle, and a unified navigation integration covering `@react-navigation/native`, `expo-router`, and Wix `react-native-navigation`. Ships an iOS Swift module driven by `apm-agent-ios` via SPM (RN 0.75+ `spm_dependency` helper) and an Android Kotlin module driven by `apm-agent-android` v1.5.0, both supporting Old Architecture and New Architecture from a single codebase.
