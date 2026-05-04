import type { EdotConfig, UserAttributesSpanScope } from './types';

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

export const DEFAULT_USER_ATTRIBUTES_SPAN_SCOPE: UserAttributesSpanScope = 'id-only';
