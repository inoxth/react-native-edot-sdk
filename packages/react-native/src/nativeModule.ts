import { NativeModules } from 'react-native';
import type { Spec } from './NativeEdotReactNative';

const LINKING_ERROR =
  '[EDOT] Native module not found. Telemetry will be disabled. ' +
  'Run `pod install` (iOS) or sync Gradle (Android).';

function createNoOpModule(): Spec {
  let warned = false;

  return new Proxy({} as Spec, {
    get(_target, prop) {
      if (!warned) {
        console.warn(LINKING_ERROR);
        warned = true;
      }

      return (..._args: unknown[]) => {
        if (prop === 'initialize' || prop === 'getCurrentSessionId') {
          return Promise.resolve(prop === 'getCurrentSessionId' ? '' : undefined);
        }
        if (prop === 'startSpan') {
          return '';
        }
        return undefined;
      };
    },
  });
}

function loadNativeModule(): Spec {
  const isTurboModuleEnabled = global.__turboModuleProxy != null;

  if (isTurboModuleEnabled) {
    try {
      return require('./NativeEdotReactNative').default;
    } catch {
      // TurboModule not available, fall through to NativeModules
    }
  }

  const nativeModule = NativeModules.EdotReactNative;
  if (nativeModule) {
    return nativeModule as Spec;
  }

  return createNoOpModule();
}

export const EdotNativeModule: Spec = loadNativeModule();
