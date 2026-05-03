export interface EdotConfig {
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;

  secretToken?: string;
  apiKey?: string;

  exportProtocol?: 'http' | 'grpc';

  sessionSamplingRate?: number;

  instrumentNetworkRequests?: boolean;
  instrumentJsErrors?: boolean;
  instrumentAppLifecycle?: boolean;
  instrumentAppStartup?: boolean;

  tracePropagationTargets?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];

  trackingConsent?: TrackingConsent;
  urlSanitizer?: (url: string) => string;

  globalAttributes?: Record<string, string | number | boolean>;

  userAttributes?: UserAttributesConfig;

  graphqlUrls?: (string | RegExp)[];

  debug?: boolean;

  /**
   * Fully suppresses native agent startup when `true`. No auto-instrumentation,
   * no crash reporting, no central-config polling, and no OTLP exports run.
   *
   * Distinct from `trackingConsent: 'not_granted'`, which gates JS-side
   * emission only — the native agent still starts. Use `disableAgent: true`
   * when the agent must not start at all (e.g. test environments, hard
   * opt-out before consent is captured).
   */
  disableAgent?: boolean;

  /**
   * Tunes the on-disk persistence buffer used by the iOS agent for failed
   * export retries. Applies to metrics, traces, and logs on iOS.
   *
   * - `'default'` — low runtime impact, 4 MB per file, 512 MB directory cap (default).
   * - `'lowUsage'` — alias for `'default'`; use on storage-constrained devices.
   * - `'highVolume'` — instant delivery, shorter rotation interval; use on lossy networks.
   *
   * Has no effect on Android.
   */
  persistencePreset?: 'default' | 'lowUsage' | 'highVolume';

  /**
   * Overrides the central-config polling endpoint without affecting OTLP
   * exports. Must be an absolute `http://` or `https://` URL.
   *
   * Falls back to `serverUrl` when omitted.
   *
   * iOS only. Has no effect on Android.
   */
  managementUrl?: string;

  /**
   * Enables or disables central-config remote management polling.
   * Defaults to `true` when omitted. Set to `false` to disable polling
   * entirely regardless of `managementUrl`.
   *
   * iOS only. Has no effect on Android.
   */
  remoteManagement?: boolean;

  ios?: EdotIosConfig;
  android?: EdotAndroidConfig;
}

export interface EdotIosConfig {
  enableCrashReporting?: boolean;
  enableURLSessionInstrumentation?: boolean;
  enableViewControllerInstrumentation?: boolean;
  enableAppMetricInstrumentation?: boolean;
  enableSystemMetrics?: boolean;
  enableLifecycleEvents?: boolean;
  useOpAMP?: boolean;
}

export interface EdotAndroidConfig {
  diskBufferingEnabled?: boolean;
}

export type TrackingConsent = 'granted' | 'not_granted' | 'pending';

export type UserAttributesSpanScope = 'all' | 'id-only' | 'none';

export interface UserAttributesConfig {
  includeInSpans?: UserAttributesSpanScope;
}

export interface EdotUser {
  id: string;
  email?: string;
  name?: string;
}
