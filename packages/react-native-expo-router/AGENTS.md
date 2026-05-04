# AGENTS.md — @inox/react-native-edot-expo-router

## Overview

Expo Router integration. Creates view spans on pathname changes via `<EdotExpoNavigationProvider>` wrapper component.

## Structure

```
src/
├── index.ts                          # Exports EdotExpoNavigationProvider + types
├── expo-navigation-provider.tsx      # React provider component
├── types.ts                          # EdotExpoNavigationProviderProps
└── __tests__/
    └── expo-navigation-provider.test.tsx
```

## Key API

`<EdotExpoNavigationProvider>` — wrap around `<Slot />` in your layout. Tracks pathname via `usePathname()` from expo-router and creates/ends view spans on changes.

Optional `screenNameMapper(pathname)` transforms pathnames (e.g., `/products/42` → `/products/:id`).

## Span Shape

- Span name: plain `<displayName>` (the pathname after any `screenNameMapper` transformation; no `"Navigation: "` prefix)
- Span kind: `INTERNAL` (default)
- Tracer scope: `instrumentationName = "@inox/react-native-edot-expo-router"`
- Attributes: `screen.name`, plus `last.screen.name` only when a prior screen exists _and_ differs from the current
- `view.name` / `view.previous` / `view.url` / `view.transition_type` are NOT emitted (renamed/dropped in `2026-05-04-align-navigation-with-elastic-mobile-spec`)

## Key Patterns

- Uses `useEffect` keyed on `displayName` (not raw pathname) so two pathnames mapping to the same `displayName` do not emit a new span — that's the point of the mapper
- Lazy-requires `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps
- Imports `ActiveViewContext` from `@inox/react-native-edot-shared` (not from the SDK)
- Stores span ID, previous screen name, and latest screen name in refs
- Registers a foreground re-emitter on mount; re-emitter resets `previousScreenName = null` and re-runs first-emission for the latest stashed pathname. Unmount cleanup unregisters it.

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `expo-router >=3.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
