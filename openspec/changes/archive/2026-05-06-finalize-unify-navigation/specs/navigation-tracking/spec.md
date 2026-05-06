## MODIFIED Requirements

### Requirement: Tracer scope
The SDK SHALL pass `instrumentationName = "@inox/react-native-edot-navigation"` to `EdotNativeModule.startSpan(...)` for every navigation span so all navigation spans carry the same `instrumentation.scope.name` regardless of which navigator emitted them. The unified package owns one OpenTelemetry scope.

#### Scenario: Component span scope
- **WHEN** `<EdotNavigationProvider>` emits a screen-lifetime span
- **THEN** the span SHALL carry `instrumentation.scope.name = "@inox/react-native-edot-navigation"`

#### Scenario: Wix listener span scope
- **WHEN** `registerEdotNavigationListener` emits a screen-lifetime span
- **THEN** the span SHALL carry `instrumentation.scope.name = "@inox/react-native-edot-navigation"`
