import type { EdotConfig, UserAttributesSpanScope } from './types';

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

export const DEFAULT_USER_ATTRIBUTES_SPAN_SCOPE: UserAttributesSpanScope = 'id-only';
