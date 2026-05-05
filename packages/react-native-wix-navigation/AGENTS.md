# AGENTS.md — @inox/react-native-edot-wix-navigation

## Overview

Wix react-native-navigation integration. Creates view spans on `ComponentDidAppear` events via `registerEdotNavigationListener()`.

## Structure

```
src/
├── index.ts                      # Exports registerEdotNavigationListener + types
├── wix-navigation-tracker.ts     # Navigation listener implementation
├── types.ts                      # WixNavigation, ComponentDidAppearEvent, options
└── __tests__/
    └── wix-navigation-tracker.test.ts
```

## Key API

`registerEdotNavigationListener(Navigation, options?)` — registers a `componentDidAppear` listener. Returns a cleanup function that removes the listener, ends the current span, and clears the view context.

Optional `screenNameMapper(componentName)` transforms component names.

## Span Shape

- Span name: plain `<componentName>` (after any `screenNameMapper` transformation; no `"Navigation: "` prefix)
- Span kind: `INTERNAL` (default)
- Tracer scope: `instrumentationName = "@inox/react-native-edot-wix-navigation"`
- Attributes: `screen.name`, plus `last.screen.name` only when a prior screen exists _and_ differs from the current
- `view.name` / `view.previous` / `view.transition_type` are NOT emitted (renamed/dropped in `2026-05-04-align-navigation-with-elastic-mobile-spec`)

## Key Patterns

- Lifecycle is delegated to `createNavigationLifecycle` exported from `@inox/react-native-edot-navigation`. All three navigation plugins (react-navigation, expo-router, wix-navigation) share that helper.
- The tracker stashes the most recent `ComponentDidAppear` event so the lifecycle's foreground re-emitter can read the current screen via `getCurrentScreenName`. Live events call `lifecycle.onScreen(name)`, which dedupes against the previous emitted name internally.
- Cleanup removes the wix listener and calls `lifecycle.cleanup()` (which unregisters the foreground re-emitter and clears active view context).

## Dependencies

- `@inox/react-native-edot-navigation` (workspace) — provides `createNavigationLifecycle`
- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `react-native-navigation >=7.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
