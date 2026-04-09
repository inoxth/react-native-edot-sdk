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

## Key Patterns

- Lazy-requires `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps
- Imports `ActiveViewContext` from `@inox/react-native-edot-shared` (not from the SDK)
- Ignores duplicate screen events (same screen appearing twice)

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `react-native-navigation >=7.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
