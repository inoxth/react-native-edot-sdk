# AGENTS.md — @inox/react-native-edot-sdk

## Overview

Core EDOT React Native SDK. Config validation, native bridge (TurboModule + NativeModules + no-op fallback), auto-instrumentation (fetch, XHR, errors, lifecycle, startup, span cleanup), public API, and React components.

## Structure

```
src/
├── index.ts                    # Public exports
├── EdotReactNative.ts          # Main SDK — initialize(), setUser(), log(), etc.
├── nativeModule.ts             # Native bridge with TurboModule-first fallback
├── NativeEdotReactNative.ts    # TurboModule spec (codegen interface)
├── config.ts                   # Config validation (throws on invalid)
├── types.ts                    # EdotConfig, EdotUser, platform config types
├── defaults.ts                 # EDOT_DEFAULTS for instrumentation toggles
├── activeViewContext.ts        # Re-export from @inox/react-native-edot-shared
├── resource.ts                 # Resource attribute detection
├── instrumentation/
│   ├── fetch.ts                # fetch() monkey-patch with span creation
│   ├── xhr.ts                  # XMLHttpRequest monkey-patch
│   ├── errors.ts               # Global error + promise rejection handlers
│   ├── lifecycle.ts            # AppState change tracking
│   ├── startup.ts              # Cold/warm start tracing
│   ├── spanCleanup.ts          # Span lifecycle management
│   ├── traceContext.ts         # W3C traceparent generation
│   ├── graphql.ts              # GraphQL operation name extraction
│   └── urlUtils.ts             # URL parsing, sanitization, filtering
├── components/
│   └── EdotErrorBoundary.tsx   # React error boundary
└── interactions/
    ├── use-edot-action.ts      # useEdotAction() hook
    └── with-edot-tracking.tsx  # withEdotTracking() HOC
ios/                            # Native iOS module (Swift)
android/                        # Native Android module (Kotlin)
```

## Subpath Exports

This package exposes subpath imports used by sibling packages:
- `@inox/react-native-edot-sdk/nativeModule` — `EdotNativeModule` bridge
- `@inox/react-native-edot-sdk/active-view-context` — `ActiveViewContext` re-export

## Key Patterns

### Initialization Flow

`EdotReactNative.initialize(config)`:
1. Validates config → 2. Merges defaults + platform overrides → 3. Calls native `initialize()` → 4. Sets up JS instrumentation → 5. Stores teardown functions

### Instrumentation Pattern

Each `setup*()` function in `instrumentation/` monkey-patches a global (fetch, XHR, ErrorUtils) and returns a `() => void` teardown that restores the original.

### Native Module Loading

`nativeModule.ts` fallback chain:
1. Check `global.__turboModuleProxy` → load TurboModule via `NativeEdotReactNative.ts`
2. Fall back to `NativeModules.EdotReactNative` (old bridge)
3. Return no-op Proxy (all calls silently succeed — `startSpan()` returns `''`)

### Resource Detection

`resource.ts` detects platform attributes via React Native globals:
- `os.type` from `Platform.OS`
- `rn.hermes` from `global.HermesInternal`
- `rn.architecture` from `global.nativeFabricUIManager` (fabric vs bridge)
- Global type augmentations in `globals.d.ts`

## Dependencies

- `@inox/react-native-edot-shared` (workspace)
- Peer: `react >=18.0.0`, `react-native >=0.72.0`

## Testing

Jest with `react-native` preset. `moduleNameMapper` resolves `@inox/react-native-edot-shared` to `../shared/src/`.
