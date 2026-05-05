# AGENTS.md — @inox/react-native-edot-expo-router

## Overview

Expo Router integration. Creates view spans on route changes via `<EdotExpoNavigationProvider>` wrapper component. Subscribes to navigation `state` events on a `useNavigationContainerRef()` ref — does **not** use `usePathname()`.

## Structure

```
src/
├── index.ts                          # Exports EdotExpoNavigationProvider + types
├── expo-navigation-provider.tsx      # React provider component
├── types.ts                          # EdotExpoNavigationProviderProps + ExpoNavigationContainerRef
└── __tests__/
    └── expo-navigation-provider.test.tsx
```

## Key API

`<EdotExpoNavigationProvider navigationRef={navigationRef} screenNameMapper={...}>` — wrap around `<Stack>` (or `<Slot>`) in your root `_layout.tsx`. The `navigationRef` prop is **required** and must come from expo-router's `useNavigationContainerRef()`.

Optional `screenNameMapper(routeName, params?)` transforms route names (e.g., `'UserProfile'` + `{ id: 42 }` → `'UserProfile/:id'`).

```tsx
import { Stack, useNavigationContainerRef } from 'expo-router';
import { EdotExpoNavigationProvider } from '@inox/react-native-edot-expo-router';

const navigationRef = useNavigationContainerRef();
return (
  <EdotExpoNavigationProvider navigationRef={navigationRef}>
    <Stack />
  </EdotExpoNavigationProvider>
);
```

## Span Shape

- Span name: route segment name (e.g. `'index'`, `'demos'`, `'network'`, `'(tabs)'`) after any `screenNameMapper` transformation. **Not** a URL pathname.
- Span kind: `INTERNAL` (default)
- Tracer scope: `instrumentationName = "@inox/react-native-edot-expo-router"`
- Attributes: `screen.name`, plus `last.screen.name` only when a prior screen exists _and_ differs from the current

## Key Patterns

- Lifecycle is delegated to `createNavigationLifecycle` exported from `@inox/react-native-edot-navigation`. Both this plugin and `react-navigation` share that helper.
- The provider uses one `useEffect` keyed on `navigationRef`: it constructs a lifecycle, emits the current route once, and subscribes via `addListener('state', emitCurrent)`. Unmount unsubscribes and calls `lifecycle.cleanup()`.
- `screenNameMapper` is captured in a ref so callers don't need to memoize it; the lifecycle is not recreated on each render.
- Foreground re-emit and active-view-context updates are handled inside `createNavigationLifecycle` — see the navigation package for details.

## Why route names, not pathnames

Two reasons we do **not** emit URL pathnames as span names:

1. **APM ingestion drops URL-shaped transactions.** Manual testing showed `usePathname()`-derived names like `/demos/network` arrive in the iOS native bridge but are silently dropped by Elastic APM Server. Route names (`network`) survive consistently.
2. **Alignment with our react-navigation plugin.** Because expo-router is built on `@react-navigation/native`, both plugins can share the same lifecycle and emit identifier-style names. Mixing URL paths from expo-router with route names from react-navigation in the same APM dashboard would be confusing.

## Dependencies

- `@inox/react-native-edot-navigation` (workspace) — provides `createNavigationLifecycle`
- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
- Peer: `expo-router >=3.0.0`, `react >=18.0.0`, `react-native >=0.72.0`
