## MODIFIED Requirements

### Requirement: Screen-lifetime span per visit
Each navigation plugin SHALL create exactly one OpenTelemetry span per screen visit. The span SHALL start on the first event indicating the screen is visible (React Navigation `onReady` / `onStateChange`, Expo Router `usePathname` change, Wix `componentDidAppear`) and SHALL end when (a) a different screen becomes visible, (b) the navigation container/provider/listener is torn down, or (c) the SDK's AppState handler reports `'background'`.

#### Scenario: Span starts on first visible event
- **WHEN** the navigation library reports the initial visible screen as `"Home"`
- **THEN** a span SHALL be created with `screen.name = "Home"`

#### Scenario: Span ends on next screen
- **GIVEN** an active screen-lifetime span for `"Home"`
- **WHEN** the navigation library reports a new screen `"ProductDetail"`
- **THEN** the `"Home"` span SHALL end with status code `1` (OK)
- **AND** a new span SHALL start with `screen.name = "ProductDetail"`

#### Scenario: Span ends on background
- **GIVEN** an active screen-lifetime span for `"Home"`
- **WHEN** the SDK's AppState handler reports `'background'`
- **THEN** the `"Home"` span SHALL end with status code `1`

### Requirement: Span name format
The span name SHALL be the screen name itself (e.g. `"HomeScreen"`, `"ProductDetail"`, `"/products/42"`), without any prefix or suffix.

#### Scenario: Plain screen-name span name
- **WHEN** the active screen is `"ProductDetail"`
- **THEN** the screen-lifetime span SHALL have `name = "ProductDetail"`

#### Scenario: No "Navigation: " prefix
- **WHEN** any screen becomes visible
- **THEN** the span name SHALL NOT begin with `"Navigation: "`

### Requirement: Span kind INTERNAL
The screen-lifetime span SHALL have OpenTelemetry span kind `INTERNAL` (the default; matches opentelemetry-android upstream convention).

#### Scenario: Span kind is INTERNAL
- **WHEN** any screen-lifetime span is created
- **THEN** the span SHALL have `kind = INTERNAL`

### Requirement: Span attribute `screen.name`
Every screen-lifetime span SHALL include the attribute `screen.name`, set to the screen name as produced by the plugin (after any `screenNameMapper` transformation).

#### Scenario: Attribute set
- **WHEN** a span starts for screen `"Home"`
- **THEN** the span SHALL have attribute `screen.name = "Home"`

### Requirement: Span attribute `last.screen.name` only when changed
A screen-lifetime span SHALL include the attribute `last.screen.name` only when both (a) a prior screen exists in the plugin's module state, and (b) the prior screen name differs from the new screen name. Initial visits and foreground re-emits SHALL omit this attribute.

#### Scenario: First screen omits last.screen.name
- **WHEN** the very first screen-lifetime span is created for `"Home"`
- **THEN** the span SHALL NOT include the `last.screen.name` attribute

#### Scenario: Subsequent navigation includes last.screen.name
- **GIVEN** the prior screen was `"Home"`
- **WHEN** the user navigates to `"ProductDetail"`
- **THEN** the new span SHALL have `last.screen.name = "Home"`

#### Scenario: Foreground re-emit to same screen omits last.screen.name
- **GIVEN** the app was on `"Home"` before backgrounding
- **WHEN** the app foregrounds and the plugin re-emits `"Home"`
- **THEN** the new span SHALL NOT include the `last.screen.name` attribute

### Requirement: Removal of `view.transition_type`
Screen-lifetime spans SHALL NOT include any attribute named `view.transition_type`. There is no replacement attribute.

#### Scenario: Attribute is absent
- **WHEN** any screen-lifetime span is emitted
- **THEN** the attribute `view.transition_type` SHALL NOT be present

### Requirement: `screenNameMapper` callback
Each navigation plugin SHALL accept an optional `screenNameMapper` callback in its options. The mapper signature is plugin-specific (route name + params for React Navigation, pathname for Expo Router, component name for Wix). When provided, the mapper output SHALL be used as `screen.name` and the span name.

#### Scenario: Mapper applied
- **WHEN** a plugin is configured with `screenNameMapper: (n) => n.replace(/\d+/, ":id")`
- **AND** the navigation library reports screen `"User/42"`
- **THEN** the span name SHALL be `"User/:id"`
- **AND** `screen.name` SHALL equal `"User/:id"`

### Requirement: Per-instrumentation tracer scope
Each navigation plugin SHALL pass its own `instrumentationName` to `EdotNativeModule.startSpan(...)` so spans carry a distinguishable `instrumentation.scope.name` on the wire:

| Plugin | Scope |
|---|---|
| `@inox/react-native-edot-navigation` | `"@inox/react-native-edot-navigation"` |
| `@inox/react-native-edot-expo-router` | `"@inox/react-native-edot-expo-router"` |
| `@inox/react-native-edot-wix-navigation` | `"@inox/react-native-edot-wix-navigation"` |

#### Scenario: Scope set per plugin
- **WHEN** the React Navigation plugin starts a screen-lifetime span
- **THEN** the span's `instrumentation.scope.name` SHALL be `"@inox/react-native-edot-navigation"`

## REMOVED Requirements

### Requirement: Legacy `view.*` attributes
**Reason:** Replaced by `screen.name` and `last.screen.name` to align with apm-agent-android (via opentelemetry-android) and Kibana mobile RUM views.

**Migration:** None required (SDK is unpublished). Internal callers that read `view.name` / `view.previous` / `view.transition_type` from spans SHALL be updated to read `screen.name` and `last.screen.name`. `view.transition_type` has no replacement.
