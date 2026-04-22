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

  const nativeModule = NativeModules.EdotReactNative;
  if (nativeModule) {
    return nativeModule as Spec;
  }

  return createNoOpModule();
}

export const EdotNativeModule: Spec = loadNativeModule();
