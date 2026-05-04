# AGENTS.md — @inox/react-native-edot-shared

## Overview

Shared cross-package state for the EDOT React Native SDK. Pure JS/TS — no React Native dependency. All navigation plugins and the main SDK depend on this package.

## Structure

```
src/
├── index.ts               # Re-exports ActiveViewContext + ActiveView type
└── activeViewContext.ts    # Global active view singleton with listener support
```

## Key API

`ActiveViewContext` singleton with:

- `setActiveView({ name, spanId })` — called by navigation plugins on screen change
- `getActiveView()` — called by instrumentation modules to correlate spans to views
- `clearActiveView()` — called on navigation cleanup/unmount
- `addListener(callback)` — returns unsubscribe function for view change events
- `registerForegroundReEmitter(fn)` — navigation plugins register a re-emitter at construction. Returns an idempotent unregister function. The SDK's app-state listener invokes `notifyForegroundReEmitters()` after `AppState` returns to `'active'` from a real `'background'` so plugins can re-emit the current screen with `previousScreenName = null` (omitting `last.screen.name` to mark it as a fresh foreground visit).
- `notifyForegroundReEmitters()` — invokes registered re-emitters in registration order, swallowing per-callback exceptions

## Dependencies

None (pure JS/TS).

## Consumers

- `@inox/react-native-edot-sdk` — re-exports `ActiveViewContext` at `/active-view-context`
- All 3 navigation plugins — import `ActiveViewContext` directly to set/clear active view and register foreground re-emitters
- Instrumentation modules (fetch, XHR, errors, interactions) — read `getActiveView()` to correlate spans (emit `screen.name` and `screen.id`)
- `app-state.ts` instrumentation — calls `notifyForegroundReEmitters()` on `'background' → 'active'` transitions

## Anti-Patterns

- **Don't add React Native dependencies** — this package must stay pure JS/TS so it can be imported by any package without pulling in native code.
- **Don't import from `@inox/react-native-edot-sdk`** — dependency flows the other direction.
