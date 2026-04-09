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

## Key Patterns

- Uses `useEffect` to track pathname changes and manage span lifecycle
- Lazy-requires `@inox/react-native-edot-sdk/nativeModule` to avoid circular deps
- Imports `ActiveViewContext` from `@inox/react-native-edot-shared` (not from the SDK)
- Stores span ID and previous pathname in refs

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `expo-router >=3.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
