import { Platform } from 'react-native';
import type { EdotConfig, EdotUser, TrackingConsent } from './types';
import { DEFAULT_USER_ATTRIBUTES_SPAN_SCOPE, EDOT_DEFAULTS } from './defaults';
import { validateConfig } from './config';
import { EdotNativeModule } from './nativeModule';
import { redactedString } from '@inox/react-native-edot-shared';
import type { RedactedString } from '@inox/react-native-edot-shared';
import { setupFetchInstrumentation } from './instrumentation/fetch';
import { setupXhrInstrumentation } from './instrumentation/xhr';
import { setupErrorHandler } from './instrumentation/errors';
import { setupStartupTracing } from './instrumentation/startup';
import { setupAppStateTracking } from './instrumentation/app-state';
import { setupSpanCleanup } from './instrumentation/spanCleanup';

interface InternalConfig {
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  debug: boolean;
  userAttributesIncludeInSpans: string;
  sessionSamplingRate?: number;
  trackingConsent?: string;
  secretToken?: RedactedString;
  apiKey?: RedactedString;
  exportProtocol?: string;
  globalAttributes?: Record<string, string | number | boolean>;
  [key: string]: unknown;
}

let initialized = false;
let initPromise: Promise<void> | null = null;
const teardowns: Array<() => void> = [];

function mergeConfig(config: EdotConfig): InternalConfig {
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
    ...(config.sessionSamplingRate !== undefined
      ? { sessionSamplingRate: config.sessionSamplingRate }
      : {}),
    ...(config.trackingConsent ? { trackingConsent: config.trackingConsent } : {}),
    ...(config.secretToken ? { secretToken: redactedString(config.secretToken) } : {}),
    ...(config.apiKey ? { apiKey: redactedString(config.apiKey) } : {}),
    ...(config.exportProtocol ? { exportProtocol: config.exportProtocol } : {}),
    ...(config.globalAttributes ? { globalAttributes: config.globalAttributes } : {}),
    ...platformConfig,
  };
}

function revealCredentials(config: InternalConfig): Record<string, unknown> {
  return {
    ...config,
    ...(config.secretToken ? { secretToken: config.secretToken.reveal() } : {}),
    ...(config.apiKey ? { apiKey: config.apiKey.reveal() } : {}),
  };
}

function debugLog(config: EdotConfig, ...args: unknown[]): void {
  if (config.debug) {
    console.log('[EDOT]', ...args);
  }
}

async function doInitialize(config: EdotConfig): Promise<void> {
  try {
    validateConfig(config);

    const internalConfig = mergeConfig(config);

    debugLog(config, 'Initializing with config:', {
      serverUrl: config.serverUrl,
      serviceName: config.serviceName,
      debug: config.debug,
    });

    await EdotNativeModule.initialize(revealCredentials(internalConfig));

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

    if (merged.instrumentAppStartup) {
      teardowns.push(setupStartupTracing(config));
      debugLog(config, 'Startup tracing enabled');
    }

    if (merged.appStateTracking) {
      teardowns.push(setupAppStateTracking());
      debugLog(config, 'App-state tracking enabled');
    }

    teardowns.push(setupSpanCleanup());

    debugLog(config, 'SDK initialized successfully');
    initialized = true;
  } finally {
    initPromise = null;
  }
}

export const EdotReactNative = {
  async initialize(config: EdotConfig): Promise<void> {
    if (initialized) {
      console.warn('[EDOT] SDK already initialized, ignoring duplicate call');
      return;
    }

    if (initPromise) {
      return initPromise;
    }

    initPromise = doInitialize(config);
    return initPromise;
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
    if (!__DEV__) {
      return;
    }
    teardowns.forEach((fn) => fn());
    teardowns.length = 0;
    initialized = false;
    initPromise = null;
  },
};
