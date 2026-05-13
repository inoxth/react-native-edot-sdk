import { NativeModules } from 'react-native';
import type { Spec } from './NativeEdotReactNative';

const LINKING_ERROR =
  '[EDOT] Native module not found. Telemetry will be disabled. ' +
  'Run `pod install` (iOS) or sync Gradle (Android).';

function isSpec(x: unknown): x is Spec {
  return typeof x === 'object' && x !== null;
}

function createNoOpModule(): Spec {
  let warned = false;

  const target: Spec = {
    initialize: () => Promise.resolve(),
    getCurrentSessionId: () => Promise.resolve(''),
    setUser: () => undefined,
    clearUser: () => undefined,
    setSessionAttribute: () => undefined,
    setGlobalAttribute: () => undefined,
    removeGlobalAttribute: () => undefined,
    reportJsException: () => undefined,
    startSpan: () => '',
    startClientSpan: () => '',
    getTraceparent: () => '',
    endSpan: () => undefined,
    setSpanAttribute: () => undefined,
    setSpanAttributeNumber: () => undefined,
    setSpanAttributeBoolean: () => undefined,
    recordSpanException: () => undefined,
    recordMetric: () => undefined,
    emitLog: () => undefined,
    setTrackingConsent: () => undefined,
  };

  return new Proxy(target, {
    get(t, prop) {
      if (!warned) {
        console.warn(LINKING_ERROR);
        warned = true;
      }
      return Reflect.get(t, prop);
    },
  });
}

function loadNativeModule(): Spec {
  // Try TurboModule first (New Architecture). Fall back to NativeModules for Old Architecture.
  // __turboModuleProxy alone is unreliable in bridgeless mode, so we attempt the require directly.
  try {
    const turboModule: Spec | null = require('./NativeEdotReactNative').default;
    if (turboModule != null) {
      return turboModule;
    }
  } catch (sdkError) {
    const message = sdkError instanceof Error ? sdkError.message : String(sdkError);
    const isNotFound =
      message.includes('Cannot find module') ||
      message.includes('Module not found') ||
      message.includes('could not be found');
    if (!isNotFound) {
      console.warn('[EDOT] TurboModule load failed, falling back to NativeModules:', sdkError);
    }
  }

  const nativeModule: unknown = NativeModules.EdotReactNative;
  if (isSpec(nativeModule)) {
    return nativeModule;
  }

  return createNoOpModule();
}

const loadedModule = loadNativeModule();

// WARNING: Never replace the Proxy below with object spread ({...loadedModule, ...}).
// TurboModule instances store methods on the prototype, not as own properties.
// Object spread silently drops prototype methods, causing runtime errors like
// "EdotNativeModule missing expected methods: endSpan".
// Use Proxy with Reflect.get() to preserve the full prototype chain.
//
// Bridge arg-count behaviour:
// - Android New Arch (TurboModule) is STRICT — `JavaTurboModule.cpp` throws
//   `JavaTurboModuleInvalidArgumentCountException` when JS arity != Java arity
//   (codegen registers `startSpan`/`startClientSpan` with arity 4).
// - iOS Old Arch (RCTBridge) converts JS `null` → NSNull, which can't cast to
//   an optional NSString.
// We satisfy both by always calling the 4-arg form with empty-string sentinels
// for absent values. Empty string is a valid NSString/String on both sides.
// Native code treats empty `parentSpanId` as no-parent (registry lookup miss)
// and empty `instrumentationName` as the default scope (`react-native-edot`).

const startSpanWrapper = function (
  name: string,
  attributes: Record<string, unknown>,
  parentSpanId?: string | null,
  instrumentationName?: string | null,
): string {
  return loadedModule.startSpan(name, attributes, parentSpanId ?? '', instrumentationName ?? '');
};

const startClientSpanWrapper = function (
  name: string,
  attributes: Record<string, unknown>,
  parentSpanId?: string | null,
  instrumentationName?: string | null,
): string {
  return loadedModule.startClientSpan(
    name,
    attributes,
    parentSpanId ?? '',
    instrumentationName ?? '',
  );
};

/**
 * Wraps startSpan / startClientSpan to satisfy strict-arity bridges (Android
 * TurboModule) while avoiding `null` → NSNull on iOS Old Arch. Always emits a
 * 4-arg call with empty-string sentinels for absent values.
 *
 * A Proxy is used instead of object spread so that prototype methods
 * (endSpan, initialize, etc.) remain accessible on TurboModule instances.
 */
export const EdotNativeModule: Spec = new Proxy(loadedModule, {
  get(target, prop, receiver) {
    if (prop === 'startSpan') {
      return startSpanWrapper;
    }
    if (prop === 'startClientSpan') {
      return startClientSpanWrapper;
    }
    return Reflect.get(target, prop, receiver);
  },
});
