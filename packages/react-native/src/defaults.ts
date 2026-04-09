import type { EdotConfig } from './types';

type EdotDefaults = Required<
  Pick<
    EdotConfig,
    | 'instrumentNetworkRequests'
    | 'instrumentJsErrors'
    | 'instrumentAppLifecycle'
    | 'instrumentAppStartup'
    | 'debug'
  >
>;

export const EDOT_DEFAULTS: EdotDefaults = {
  instrumentNetworkRequests: true,
  instrumentJsErrors: true,
  instrumentAppLifecycle: true,
  instrumentAppStartup: true,
  debug: false,
};
