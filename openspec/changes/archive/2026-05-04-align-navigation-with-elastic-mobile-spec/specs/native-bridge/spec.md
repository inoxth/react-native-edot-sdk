## ADDED Requirements

### Requirement: Optional `instrumentationName` parameter on `startSpan` / `startClientSpan`
The TurboModule spec, iOS legacy bridge, iOS Swift implementation, Android oldarch module, Android newarch module, and Android shared module SHALL accept an optional final parameter `instrumentationName: string | null` on both `startSpan` and `startClientSpan`. When omitted or `null`, the implementation SHALL use the default tracer name `"react-native-edot"`. When provided, the implementation SHALL retrieve the tracer via the OTel `TracerProvider` using the supplied name as `instrumentationName`.

#### Scenario: Default tracer when omitted
- **WHEN** any caller invokes `EdotNativeModule.startSpan(name, attrs, parentSpanId)` without an `instrumentationName`
- **THEN** the span SHALL be started on a tracer obtained with `instrumentationName = "react-native-edot"`

#### Scenario: Per-callsite tracer when provided
- **WHEN** a caller invokes `EdotNativeModule.startSpan(name, attrs, parentSpanId, "@inox/react-native-edot-navigation")`
- **THEN** the span SHALL be started on a tracer obtained with `instrumentationName = "@inox/react-native-edot-navigation"`
- **AND** the span SHALL appear on the wire with `instrumentation.scope.name = "@inox/react-native-edot-navigation"`

### Requirement: Android old-architecture exposes `startClientSpan`
The Android old-architecture module (`packages/react-native/android/src/oldarch/java/com/edot/reactnative/EdotReactNativeModule.kt`) SHALL declare `startClientSpan` as an `@ReactMethod(isBlockingSynchronousMethod = true)` returning a span ID synchronously, parity with the iOS legacy bridge. The new `instrumentationName` parameter SHALL be present on this declaration.

#### Scenario: Old-arch startClientSpan
- **GIVEN** the app runs on Android with the Old Architecture (Bridge)
- **WHEN** JS calls `EdotNativeModule.startClientSpan(name, attrs, parentSpanId, instrumentationName)`
- **THEN** the call SHALL be routed to `EdotReactNativeModuleImpl.startClientSpan(...)`
- **AND** a non-empty span ID SHALL be returned synchronously

## MODIFIED Requirements

### Requirement: TurboModule spec for New Architecture
The SDK SHALL provide a TurboModule spec (`NativeEdotReactNative.ts`) defining the complete native interface. The spec SHALL be used by codegen to generate C++ bindings for JSI. All bridge methods SHALL be defined in this spec, including `startSpan(name, attributes, parentSpanId, instrumentationName)` and `startClientSpan(name, attributes, parentSpanId, instrumentationName)` with `parentSpanId?: string | null` and `instrumentationName?: string | null`.

#### Scenario: TurboModule codegen produces valid bindings
- **WHEN** React Native codegen runs against `NativeEdotReactNative.ts`
- **THEN** valid C++ bindings SHALL be generated without errors
- **THEN** the native modules SHALL conform to the generated spec interface, including the new `instrumentationName` argument
