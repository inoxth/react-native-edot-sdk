# View Correlation Specification

## Purpose
Track the currently active screen and correlate it with network and error spans by attaching view context attributes and span links.

## Requirements

### Requirement: ActiveViewContext tracks the current screen
The SDK SHALL provide an `ActiveViewContext` module that maintains the currently active screen's span context (`traceId`, `spanId`) and view name. The module SHALL export `setActiveView(spanContext, viewName)`, `getActiveViewContext()`, `getActiveViewName()`, and `clearActiveView()` functions.

#### Scenario: Setting the active view
- **WHEN** `setActiveView({ traceId: 'abc', spanId: 'def' }, 'HomeScreen')` is called
- **THEN** `getActiveViewContext()` returns `{ traceId: 'abc', spanId: 'def' }`
- **THEN** `getActiveViewName()` returns `'HomeScreen'`

#### Scenario: Replacing the active view on navigation
- **WHEN** `setActiveView(contextA, 'ScreenA')` is called
- **WHEN** `setActiveView(contextB, 'ScreenB')` is called
- **THEN** `getActiveViewContext()` returns `contextB`
- **THEN** `getActiveViewName()` returns `'ScreenB'`

#### Scenario: No active view before first navigation
- **WHEN** `setActiveView` has never been called
- **THEN** `getActiveViewContext()` returns `null`
- **THEN** `getActiveViewName()` returns `null`

#### Scenario: Clearing the active view
- **WHEN** `setActiveView(context, 'Screen')` was previously called
- **WHEN** `clearActiveView()` is called
- **THEN** `getActiveViewContext()` returns `null`
- **THEN** `getActiveViewName()` returns `null`

### Requirement: SpanContext type definition
The SDK SHALL define a `SpanContext` interface with `traceId: string` and `spanId: string` properties in the core types module.

#### Scenario: SpanContext shape
- **WHEN** a `SpanContext` value is created
- **THEN** it SHALL have a `traceId` string property
- **THEN** it SHALL have a `spanId` string property

### Requirement: ActiveViewContext exported from core package
The SDK SHALL export `setActiveView`, `getActiveViewContext`, `getActiveViewName`, and `clearActiveView` from the core package's public API so navigation plugin packages can import and call them.

#### Scenario: Navigation plugin sets active view
- **WHEN** a navigation plugin imports `setActiveView` from `@inox/react-native-edot-sdk`
- **WHEN** it calls `setActiveView(spanContext, 'ProductDetail')`
- **THEN** subsequent network spans include `view.name: 'ProductDetail'`

### Requirement: Error spans include view correlation
The error handler SHALL attach the active screen name to every JS error span as a `screen.name` attribute when `ActiveViewContext.getActiveView()` returns a non-null value. When an active view exists, the error span SHALL also include a `screen.id` attribute with the active view's `spanId`. The attribute keys `view.name` and `view.id` SHALL NOT be present on any error span emitted by the SDK.

#### Scenario: Error on a screen includes screen attributes
- **WHEN** the active view is set to `"CheckoutScreen"` with span ID `"abc123"`
- **WHEN** an uncaught JS error occurs
- **THEN** the error span SHALL include attribute `screen.name = "CheckoutScreen"`
- **AND** the error span SHALL include attribute `screen.id = "abc123"`
- **AND** the error span SHALL NOT include `view.name` or `view.id`

#### Scenario: Error with no active view
- **WHEN** no active view has been set
- **WHEN** an uncaught JS error occurs
- **THEN** the error span SHALL NOT include `screen.name` or `screen.id`

### Requirement: Native bridge supports span links
The native module interface SHALL include an `addSpanLink(spanId, linkedTraceId, linkedSpanId)` method that attaches an OTel span link from the identified span to the linked span context.

#### Scenario: Span link added to network span
- **WHEN** a fetch span is created with spanId `'netSpan1'`
- **WHEN** the active view has traceId `'viewTrace1'` and spanId `'viewSpan1'`
- **THEN** `addSpanLink('netSpan1', 'viewTrace1', 'viewSpan1')` is called
- **THEN** the span has an OTel link to the view span
