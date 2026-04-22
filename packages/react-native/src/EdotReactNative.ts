import { Platform } from 'react-native';
import type { EdotConfig, EdotUser, TrackingConsent } from './types';
import { DEFAULT_USER_ATTRIBUTES_SPAN_SCOPE, EDOT_DEFAULTS } from './defaults';
import { validateConfig } from './config';
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
  const platformConfig =
    Platform.OS === 'ios' ? config.ios : Platform.OS === 'android' ? config.android : undefined;

  return {
    serverUrl: config.serverUrl,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    deploymentEnvironment: config.deploymentEnvironment,
    debug: config.debug ?? EDOT_DEFAULTS.debug,
    userAttributesIncludeInSpans:
      config.userAttributes?.includeInSpans ?? DEFAULT_USER_ATTRIBUTES_SPAN_SCOPE,
    ...(config.sessionSamplingRate !== undefined ? { sessionSamplingRate: config.sessionSamplingRate } : {}),
    ...(config.trackingConsent ? { trackingConsent: config.trackingConsent } : {}),
    ...(config.secretToken ? { secretToken: config.secretToken } : {}),
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.exportProtocol ? { exportProtocol: config.exportProtocol } : {}),
    ...(config.globalAttributes ? { globalAttributes: config.globalAttributes } : {}),
    ...platformConfig,
  };
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

  /**
   * On Android, returns an empty string: ElasticApmAgent 1.5.0 exposes
   * SessionManager only as an internal $agent_sdk API. Re-enable once
   * upstream adds a public SessionProvider accessor.
   */
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

  /** @internal */
  _resetForTesting(): void {
    teardowns.forEach((fn) => fn());
    teardowns.length = 0;
    initialized = false;
  },
};
