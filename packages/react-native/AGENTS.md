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
1. Validates config (required fields, resource-identity chars, token mutual exclusivity, sampling range) → 2. Flattens platform overrides onto the native payload → 3. Calls native `initialize()` → 4. Sets up JS instrumentation (fetch, XHR, errors, lifecycle, startup) based on `EDOT_DEFAULTS`-merged toggles, plus unconditional `setupSpanCleanup` → 5. Stores teardown functions; `_resetForTesting()` drains them.

On iOS, `EdotReactNativeAgent.preInitialize(...)` (from `ios/EdotReactNativeAgent.swift`) can be called from AppDelegate before the JS bridge loads. It enforces the same resource-identity rules as JS `validateConfig` and injects `service.name`/`service.version`/`deployment.environment` into the OTel `Resource` via `OTEL_RESOURCE_ATTRIBUTES` before `ElasticApmAgent.start(...)`. If `isPreInitialized`, the JS-side `initialize()` skips `ElasticApmAgent.start` and only records config for the bridge.

### Instrumentation Pattern

Each `setup*()` function in `instrumentation/` monkey-patches a global (fetch, XHR, ErrorUtils) and returns a `() => void` teardown that restores the original. `startup.ts` uses `requestIdleCallback` (not `InteractionManager`) to mark first-render. Startup emits a `cold` parent span with two child spans (`js_bundle_load` and `first_render`) and closes all three via `requestIdleCallback`.

### Typed Span-Attribute Bridge

The native spec (`NativeEdotReactNative.ts`) exposes three typed setters: `setSpanAttribute` (string), `setSpanAttributeNumber` (number), `setSpanAttributeBoolean` (boolean). JS instrumentation uses the number variant for HTTP body sizes, status codes, and startup timings so the native side can pick int vs. double (iOS uses `CFNumberIsFloatType`; Android uses `isIntegerValued`). Never pre-stringify a numeric attribute before handing it to the bridge.

### Native Module Loading

`nativeModule.ts` fallback chain:
1. Check `global.__turboModuleProxy` → load TurboModule via `NativeEdotReactNative.ts`
2. Fall back to `NativeModules.EdotReactNative` (old bridge)
3. Return no-op Proxy (all calls silently succeed — `startSpan()` returns `''`)

#### Native Module Wrapper (startSpan Proxy)

The exported `EdotNativeModule` is a `Proxy` around the loaded native module. It intercepts only `startSpan` to avoid passing `null`/`undefined` `parentSpanId` values across the RCTBridge (RCTBridge serializes JS `null` as `NSNull`, which cannot be converted to `NSString`). When `parentSpanId` is nullish, the wrapper calls the 2-arg overload; otherwise it passes all 3 args.

**Critical:** The wrapper must use `Proxy` + `Reflect.get()` — never object spread (`{...module, startSpan() {...}}`). TurboModule instances store methods on the prototype, not as own properties. Object spread silently drops them, causing runtime errors like `EdotNativeModule missing expected methods: endSpan`. The test suite includes a `preserves all Spec methods from prototype-based TurboModule instances` case that guards against this regression.

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
