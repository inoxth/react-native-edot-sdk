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

## Dependencies

None (pure JS/TS).

## Anti-Patterns

- **Don't add React Native dependencies** — this package must stay pure JS/TS so it can be imported by any package without pulling in native code.
- **Don't import from `@inox/react-native-edot-sdk`** — dependency flows the other direction.
