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

export const EdotNativeModule: Spec = loadNativeModule();
