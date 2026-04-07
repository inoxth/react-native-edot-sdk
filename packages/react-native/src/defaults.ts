import type { EdotConfig } from './types';

type EdotDefaults = Required<
  Pick<
    EdotConfig,
    | 'exportProtocol'
    | 'sessionSamplingRate'
    | 'instrumentNetworkRequests'
    | 'instrumentJsErrors'
    | 'instrumentNativeCrashes'
    | 'instrumentAppLifecycle'
    | 'instrumentAppStartup'
    | 'trackingConsent'
    | 'debug'
    | 'debugExportToConsole'
  >
>;

export const EDOT_DEFAULTS: EdotDefaults = {
  exportProtocol: 'otlp/http',
  sessionSamplingRate: 1.0,
  instrumentNetworkRequests: true,
  instrumentJsErrors: true,
  instrumentNativeCrashes: true,
  instrumentAppLifecycle: true,
  instrumentAppStartup: true,
  trackingConsent: 'granted',
  debug: false,
  debugExportToConsole: false,
};
