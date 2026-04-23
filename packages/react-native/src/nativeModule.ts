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
      console.warn(
        '[EDOT] TurboModule load failed, falling back to NativeModules:',
        sdkError,
      );
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

const startSpanWrapper = function (
  name: string,
  attributes: Record<string, unknown>,
  parentSpanId?: string | null,
): string {
  if (parentSpanId == null) {
    return (loadedModule as any).startSpan(name, attributes);
  }
  return loadedModule.startSpan(name, attributes, parentSpanId);
};

/**
 * Wraps startSpan to avoid passing null/undefined parentSpanId across the
 * native bridge. RCTBridge serializes JS null as NSNull, which fails when
 * the native side expects an optional NSString (NSNull cannot be cast to
 * NSString). By calling the 2-arg overload when parentSpanId is absent,
 * both Old and New Architecture bridges work correctly.
 *
 * A Proxy is used instead of object spread so that prototype methods
 * (endSpan, initialize, etc.) remain accessible on TurboModule instances.
 */
export const EdotNativeModule: Spec = new Proxy(loadedModule, {
  get(target, prop, receiver) {
    if (prop === 'startSpan') {
      return startSpanWrapper;
    }
    return Reflect.get(target, prop, receiver);
  },
});
