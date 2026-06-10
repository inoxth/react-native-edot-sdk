import type { EdotConfig } from './types';

type EdotDefaults = Required<
  Pick<
    EdotConfig,
    | 'instrumentNetworkRequests'
    | 'instrumentJsErrors'
    | 'instrumentAppStartup'
    | 'appStateTracking'
    | 'debug'
  >
>;

export const EDOT_DEFAULTS: EdotDefaults = {
  instrumentNetworkRequests: true,
  instrumentJsErrors: true,
  instrumentAppStartup: true,
  appStateTracking: true,
  debug: false,
};
