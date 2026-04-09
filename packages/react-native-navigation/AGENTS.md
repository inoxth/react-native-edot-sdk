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

## Key Patterns

- Lazy-requires `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps
- Imports `ActiveViewContext` from `@inox/react-native-edot-shared` (not from the SDK)
- Tracks `currentSpanId` and `previousScreenName` in module scope

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `@react-navigation/native >=6.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
