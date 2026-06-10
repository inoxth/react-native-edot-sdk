import { Platform } from 'react-native';
import type {
  EdotConfig,
  IgnoreLogRule,
  IgnoreSpanRule,
  RegexSource,
  TrackingConsent,
} from './types';
import { EDOT_DEFAULTS } from './defaults';
import { resolveResourceField, validateConfig } from './config';
import { EdotNativeModule } from './nativeModule';
import { redactedString } from '@inoxth/react-native-edot-shared';
import type { RedactedString } from '@inoxth/react-native-edot-shared';
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
  sessionSamplingRate?: number;
  trackingConsent?: string;
  secretToken?: RedactedString;
  apiKey?: RedactedString;
  exportProtocol?: string;
  [key: string]: unknown;
}

let initialized = false;
let initPromise: Promise<void> | null = null;
const teardowns: Array<() => void> = [];

function mergeConfig(config: EdotConfig): InternalConfig {
  const platformConfig =
    Platform.OS === 'ios' ? config.ios : Platform.OS === 'android' ? config.android : undefined;

  const { serviceName: _platformServiceName, ...platformExtras } = platformConfig ?? {};
  const resolvedServiceName = resolveResourceField(config, 'serviceName') ?? '';

  return {
    serverUrl: config.serverUrl,
    serviceName: resolvedServiceName,
    serviceVersion: config.serviceVersion,
    deploymentEnvironment: config.deploymentEnvironment,
    debug: config.debug ?? EDOT_DEFAULTS.debug,
    ...(config.sessionSamplingRate !== undefined
      ? { sessionSamplingRate: config.sessionSamplingRate }
      : {}),
    ...(config.trackingConsent ? { trackingConsent: config.trackingConsent } : {}),
    ...(config.secretToken ? { secretToken: redactedString(config.secretToken) } : {}),
    ...(config.apiKey ? { apiKey: redactedString(config.apiKey) } : {}),
    exportProtocol: config.exportProtocol ?? 'http',
    ...(config.disableAgent !== undefined ? { disableAgent: config.disableAgent } : {}),
    ...(config.managementUrl !== undefined ? { managementUrl: config.managementUrl } : {}),
    ...(config.enableAppMetricInstrumentation !== undefined
      ? { enableAppMetricInstrumentation: config.enableAppMetricInstrumentation }
      : {}),
    ...(config.enableSystemMetrics !== undefined
      ? { enableSystemMetrics: config.enableSystemMetrics }
      : {}),
    ...(config.attributeRedactions !== undefined
      ? { attributeRedactions: config.attributeRedactions }
      : {}),
    ...(config.ignoreSpanNames !== undefined
      ? { ignoreSpanNames: serializeSpanRules(config.ignoreSpanNames) }
      : {}),
    ...(config.ignoreLogPatterns !== undefined
      ? { ignoreLogPatterns: serializeLogRules(config.ignoreLogPatterns) }
      : {}),
    ...platformExtras,
  };
}

type SerializedSpanRule = string | RegexSource;
type SerializedLogRule = { name?: string | RegexSource; minSeverity?: string };

function serializeSpanRules(rules: ReadonlyArray<IgnoreSpanRule>): SerializedSpanRule[] {
  return rules.map((rule) => rule);
}

function serializeLogRules(rules: ReadonlyArray<IgnoreLogRule>): SerializedLogRule[] {
  return rules.map((rule) => {
    const out: SerializedLogRule = {};
    if (rule.name !== undefined) {
      out.name = rule.name;
    }
    if (rule.minSeverity !== undefined) {
      out.minSeverity = rule.minSeverity;
    }
    return out;
  });
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
      serviceName: internalConfig.serviceName,
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
