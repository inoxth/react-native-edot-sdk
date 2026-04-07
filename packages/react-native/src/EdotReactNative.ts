import { Platform } from 'react-native';
import type { EdotConfig, EdotUser, TrackingConsent } from './types';
import { EDOT_DEFAULTS } from './defaults';
import { validateConfig } from './config';
import { detectResourceAttributes } from './resource';
import { EdotNativeModule } from './nativeModule';
import { setupFetchInstrumentation } from './instrumentation/fetch';
import { setupXhrInstrumentation } from './instrumentation/xhr';
import { setupErrorHandler } from './instrumentation/errors';
import { setupLifecycleTracking } from './instrumentation/lifecycle';
import { setupStartupTracing } from './instrumentation/startup';
import { setupSpanCleanup } from './instrumentation/spanCleanup';

let initialized = false;
const teardowns: Array<() => void> = [];

function mergeConfig(config: EdotConfig): Record<string, unknown> {
  const merged = {
    ...EDOT_DEFAULTS,
    ...config,
  };

  const platformConfig =
    Platform.OS === 'ios' ? merged.ios : Platform.OS === 'android' ? merged.android : undefined;

  const resourceAttributes = detectResourceAttributes();

  const nativeConfig: Record<string, unknown> = {
    serverUrl: merged.serverUrl,
    serviceName: merged.serviceName,
    serviceVersion: merged.serviceVersion,
    deploymentEnvironment: merged.deploymentEnvironment,
    exportProtocol: merged.exportProtocol,
    sessionSamplingRate: merged.sessionSamplingRate,
    instrumentNetworkRequests: merged.instrumentNetworkRequests,
    instrumentJsErrors: merged.instrumentJsErrors,
    instrumentNativeCrashes: merged.instrumentNativeCrashes,
    instrumentAppLifecycle: merged.instrumentAppLifecycle,
    instrumentAppStartup: merged.instrumentAppStartup,
    trackingConsent: merged.trackingConsent,
    debug: merged.debug,
    debugExportToConsole: merged.debugExportToConsole,
    resourceAttributes,
    ...platformConfig,
  };

  if (merged.secretToken) {
    nativeConfig.secretToken = merged.secretToken;
  }
  if (merged.apiKey) {
    nativeConfig.apiKey = merged.apiKey;
  }
  if (merged.customExportHeaders) {
    nativeConfig.customExportHeaders = merged.customExportHeaders;
  }
  if (merged.globalAttributes) {
    nativeConfig.globalAttributes = merged.globalAttributes;
  }
  if (merged.codePushVersion) {
    nativeConfig.codePushVersion = merged.codePushVersion;
  }

  return nativeConfig;
}

function debugLog(config: EdotConfig, ...args: unknown[]): void {
  if (config.debug) {
    console.log('[EDOT]', ...args);
  }
}

export const EdotReactNative = {
  async initialize(config: EdotConfig): Promise<void> {
    if (initialized) {
      console.warn('[EDOT] SDK already initialized, ignoring duplicate call');
      return;
    }

    validateConfig(config);

    const nativeConfig = mergeConfig(config);

    debugLog(config, 'Initializing with config:', {
      serverUrl: config.serverUrl,
      serviceName: config.serviceName,
      debug: config.debug,
    });

    await EdotNativeModule.initialize(nativeConfig);
    initialized = true;

    const merged = { ...EDOT_DEFAULTS, ...config };

    if (merged.instrumentNetworkRequests) {
      teardowns.push(setupFetchInstrumentation(config));
      teardowns.push(setupXhrInstrumentation(config));
      debugLog(config, 'Network instrumentation enabled');
    }

    if (merged.instrumentJsErrors) {
      teardowns.push(setupErrorHandler(config));
      debugLog(config, 'JS error tracking enabled');
    }

    if (merged.instrumentAppLifecycle) {
      teardowns.push(setupLifecycleTracking(config));
      debugLog(config, 'Lifecycle tracking enabled');
    }

    if (merged.instrumentAppStartup) {
      teardowns.push(setupStartupTracing(config));
      debugLog(config, 'Startup tracing enabled');
    }

    teardowns.push(setupSpanCleanup());

    debugLog(config, 'SDK initialized successfully');
  },

  async getCurrentSessionId(): Promise<string> {
    return EdotNativeModule.getCurrentSessionId();
  },

  setUser(user: EdotUser): void {
    EdotNativeModule.setUser(user);
  },

  clearUser(): void {
    EdotNativeModule.clearUser();
  },

  setSessionAttribute(key: string, value: string): void {
    EdotNativeModule.setSessionAttribute(key, value);
  },

  setGlobalAttribute(key: string, value: string | number | boolean): void {
    EdotNativeModule.setGlobalAttribute(key, String(value));
  },

  removeGlobalAttribute(key: string): void {
    EdotNativeModule.removeGlobalAttribute(key);
  },

  setTrackingConsent(consent: TrackingConsent): void {
    EdotNativeModule.setTrackingConsent(consent);
  },

  log(
    severity: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    EdotNativeModule.emitLog(severity, message, attributes ?? {});
  },

  addAction(
    type: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    EdotNativeModule.emitLog('info', `UserAction: ${name}`, {
      'user_action.type': type,
      'user_action.target': name,
      ...attributes,
    });
  },

  /** @internal - exposed for testing */
  _resetForTesting(): void {
    teardowns.forEach((fn) => fn());
    teardowns.length = 0;
    initialized = false;
  },
};
