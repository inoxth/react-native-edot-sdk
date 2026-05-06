# AGENTS.md — @inox/react-native-edot-navigation

## Overview

Unified navigation tracking for React Native. One package covers three navigators:

- `@react-navigation/native` — via the `<EdotNavigationProvider navigationRef>` component
- `expo-router` (built on `@react-navigation/native`) — via the same `<EdotNavigationProvider navigationRef>` component
- `react-native-navigation` (Wix) — via the imperative `registerEdotNavigationListener(Navigation)` function

The component and the listener function both delegate to the shared `createNavigationLifecycle` helper, so all three paths emit identical span shapes and attribute sets.

## Structure

```
src/
├── index.ts                       # Public exports
├── navigation-lifecycle.ts        # createNavigationLifecycle (shared core)
├── navigation-provider.tsx        # <EdotNavigationProvider> for ref-based navigators
├── wix-listener.ts                # registerEdotNavigationListener for Wix
├── types.ts                       # NavigationContainerRefLike, WixNavigationLike, mappers
└── __tests__/
    ├── navigation-lifecycle.test.ts
    ├── navigation-provider.test.tsx
    └── wix-listener.test.ts
```

## Key APIs

### `<EdotNavigationProvider>` (react-navigation + expo-router)

```tsx
import { useNavigationContainerRef } from '@react-navigation/native'; // or 'expo-router'
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';

const navigationRef = useNavigationContainerRef();
return (
  <EdotNavigationProvider navigationRef={navigationRef} screenNameMapper={...}>
    <NavigationContainer ref={navigationRef}>...</NavigationContainer>
  </EdotNavigationProvider>
);
```

Required prop `navigationRef` is duck-typed as `NavigationContainerRefLike` — anything with `addListener('state', cb)` and `getCurrentRoute()`. Both react-navigation and expo-router satisfy this.

Optional `screenNameMapper(routeName, params?)` transforms route names.

### `registerEdotNavigationListener` (Wix)

```js
import { Navigation } from 'react-native-navigation';
import { registerEdotNavigationListener } from '@inox/react-native-edot-navigation';

Navigation.events().registerAppLaunchedListener(async () => {
  await EdotReactNative.initialize({
    /* ... */
  });
  registerEdotNavigationListener(Navigation, {
    screenNameMapper: (name) => SCREEN_NAME_MAP[name] ?? name,
  });
  Navigation.setRoot({
    /* ... */
  });
});
```

Returns a cleanup function. Wix uses an imperative API because Wix apps don't have a continuously-mounted React root — there's no React tree to mount a provider in.

### `createNavigationLifecycle` (advanced — custom adapters)

For consumers building support for a navigator we don't ship out of the box. Returns `{ onScreen(name), cleanup() }`. Both built-in surfaces use it internally.

## Span Shape

- Span name: the route segment name (e.g. `'index'`, `'demos'`, `'network'`, `'(tabs)'`) after any `screenNameMapper` transformation
- Span kind: `INTERNAL` (default)
- Tracer scope (`instrumentationName`): `"@inox/react-native-edot-navigation"` for all three navigators (component-based + Wix listener share the same scope since they live in the same package)
- Attributes: `screen.name`, plus `last.screen.name` only when a prior screen exists _and_ differs from the current

## Initialization ordering

`EdotReactNative.initialize(...)` must resolve **before** the first navigation span is emitted, otherwise the iOS native module's tracer is the OpenTelemetry no-op provider and the span is silently dropped.

- **react-navigation / expo-router**: gate the navigation tree on a `sdkReady` flag (`useState(false)` flipped to `true` after init resolves). See `example/react-navigation/src/App.tsx`.
- **Wix**: call `await EdotReactNative.initialize(...)` inside `Navigation.events().registerAppLaunchedListener` before `registerEdotNavigationListener` and before `Navigation.setRoot`. See `example/wix-navigation/index.js`.

## Peer dependencies (all optional)

```jsonc
"peerDependencies": {
  "@react-navigation/native": ">=6.0.0",   // optional — only if you use react-navigation
  "expo-router": ">=3.0.0",                // optional — only if you use expo-router
  "react-native-navigation": ">=7.0.0",    // optional — only if you use Wix
  "react": ">=18.0.0",
  "react-native": ">=0.72.0"
}
```

The package never imports any of the three navigator libraries — it only duck-types via the prop / argument. Installing one navigator does not pull in metadata for the other two.

## Dependencies

- `@inox/react-native-edot-sdk` (workspace)
- `@inox/react-native-edot-shared` (workspace)
