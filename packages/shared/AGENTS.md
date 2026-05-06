# AGENTS.md — @inox/react-native-edot-shared

## Overview

Shared cross-package state for the EDOT React Native SDK. Pure JS/TS — no React Native dependency. All navigation plugins and the main SDK depend on this package.

## Structure

```
src/
├── index.ts                # Re-exports ActiveViewContext, getNativeModule, redactedString + types
├── activeViewContext.ts    # Global active view singleton with listener support
├── getNativeModule.ts      # Cached native-module loader for sibling packages (breaks dep cycle)
└── redactedString.ts       # Credentials wrapper — toString()/toJSON() return "[REDACTED]"
```

## Key API

### `ActiveViewContext` singleton

- `setActiveView({ name, spanId })` — called by navigation plugins on screen change
- `getActiveView()` — called by instrumentation modules to correlate spans to views
- `clearActiveView()` — called on navigation cleanup/unmount
- `addListener(callback)` — returns unsubscribe function for view change events
- `registerForegroundReEmitter(fn)` — navigation plugins register a re-emitter at construction. Returns an idempotent unregister function. The SDK's app-state listener invokes `notifyForegroundReEmitters()` after `AppState` returns to `'active'` from a real `'background'` so plugins can re-emit the current screen with `previousScreenName = null` (omitting `last.screen.name` to mark it as a fresh foreground visit).
- `notifyForegroundReEmitters()` — invokes registered re-emitters in registration order, swallowing per-callback exceptions

### `getNativeModule()` — shared native-module accessor

Lazy-loads `@inox/react-native-edot-sdk/nativeModule` via `require(...)` on first call, validates that the resolved object exposes the required `EdotNativeModule` shape (`startSpan` + `endSpan` are checked), caches the result, and returns it. Sibling packages (e.g. `@inox/react-native-edot-tracer-provider`) call this instead of importing directly from the SDK to break the circular dependency that would form if the SDK package re-imported them. `resetNativeModuleCacheForTesting()` clears the cache between tests. The exported `EdotNativeModule` interface lives here too (single source of truth for the bridge shape consumed across packages).

### `redactedString(value)` — credentials redaction

Returns a `RedactedString` whose `toString()` / `toJSON()` always emit `"[REDACTED]"`. The original value is recoverable only via the non-enumerable `reveal()` method. The SDK wraps `secretToken` and `apiKey` immediately on `mergeConfig` so accidental logging or JSON serialization can't leak credentials; `revealCredentials()` unwraps just before the `EdotNativeModule.initialize(...)` call.

## Dependencies

None (pure JS/TS).

## Consumers

- `@inox/react-native-edot-sdk` — re-exports `ActiveViewContext` at `/active-view-context`; uses `redactedString` for `secretToken` / `apiKey`
- `@inox/react-native-edot-tracer-provider` — calls `getNativeModule()` for span / metric bridge access
- All 3 navigation surfaces (the unified `@inox/react-native-edot-navigation` package) — import `ActiveViewContext` directly to set/clear active view and register foreground re-emitters
- Instrumentation modules (fetch, XHR, errors, interactions) — read `getActiveView()` to correlate spans (emit `screen.name` and `screen.id`)
- `app-state.ts` instrumentation — calls `notifyForegroundReEmitters()` on `'background' → 'active'` transitions

## Anti-Patterns

- **Don't add React Native dependencies** — this package must stay pure JS/TS so it can be imported by any package without pulling in native code.
- **Don't import from `@inox/react-native-edot-sdk`** — dependency flows the other direction.
