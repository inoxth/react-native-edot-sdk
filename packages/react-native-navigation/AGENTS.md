# AGENTS.md — @inox/react-native-edot-navigation

## Overview

React Navigation (`@react-navigation/native >=6`) integration. Creates view spans on route changes via `createEdotNavigationContainerRef()`.

## Structure

```
src/
├── index.ts                 # Exports createEdotNavigationContainerRef + types
├── navigation-tracker.ts    # Navigation listener implementation
├── types.ts                 # NavigationContainerRef, EdotNavigationOptions
└── __tests__/
    └── navigation-tracker.test.ts
```

## Key API

`createEdotNavigationContainerRef(options?)` returns:

- `navigationRef` — container ref to pass to `<NavigationContainer>`
- `onStateChange` — callback for route changes
- `onReady` — callback for initial route
- `cleanup()` — ends current span, clears view context

Optional `screenNameMapper(name, params)` transforms route names.

## Span Shape

- Span name: plain `<ScreenName>` (no `"Navigation: "` prefix)
- Span kind: `INTERNAL` (default)
- Tracer scope: `instrumentationName = "@inox/react-native-edot-navigation"` (passed as 4th arg to `startSpan`)
- Attributes: `screen.name`, plus `last.screen.name` only when a prior screen exists _and_ differs from the current screen
- `view.name` / `view.previous` / `view.transition_type` are NOT emitted (renamed/dropped in `2026-05-04-align-navigation-with-elastic-mobile-spec`)

## Initialization Ordering

`<NavigationContainer>` must mount only **after** `EdotReactNative.initialize(...)` resolves. `onReady` fires synchronously on first mount and starts the initial view span via `EdotNativeModule.startSpan` — but until init resolves, the iOS native module's tracer is the OpenTelemetry default no-op provider and the span is silently dropped. The blessed pattern (see `example/react-navigation/src/App.tsx`):

```tsx
const [sdkReady, setSdkReady] = useState(false);
useEffect(() => { EdotReactNative.initialize(cfg).then(() => setSdkReady(true)); }, []);
if (!sdkReady) return <SplashOrNull />;
return <NavigationContainer ref={...} onReady={...} onStateChange={...}>...</NavigationContainer>;
```

## Key Patterns

- Lazy-requires `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps
- Imports `ActiveViewContext` from `@inox/react-native-edot-shared` (not from the SDK)
- Tracks `currentSpanId` and `previousScreenName` in module scope
- Registers a foreground re-emitter via `ActiveViewContext.registerForegroundReEmitter(...)` at construction. The re-emitter resets `previousScreenName = null` and reads `navigationRef.current?.getCurrentRoute()` live, then starts a fresh span (so foregrounded same-screen omits `last.screen.name`). `cleanup()` unregisters it.

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `@react-navigation/native >=6.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
