/**
 * Serialisable regex pattern — used in place of a `RegExp` object so the
 * config can cross the React Native bridge without loss.
 */
export interface RegexSource {
  source: string;
  flags?: string;
}

/**
 * Rules for dropping or masking individual attributes on a single signal type
 * (spans OR logs — not both simultaneously).
 *
 * Application order per signal: `drop` → `dropPattern` → `mask` → `maskPattern`.
 */
export interface RedactionRules {
  /** Exact attribute keys to remove. */
  drop?: string[];
  /**
   * Regex whose full match against an attribute key causes that key to be
   * removed. Specified as a `{ source, flags? }` object because `RegExp`
   * values do not survive the React Native bridge.
   */
  dropPattern?: RegexSource;
  /** Exact attribute keys whose values are replaced by the given string. */
  mask?: Record<string, string>;
  /**
   * Regex patterns whose full match against an attribute key causes the
   * value to be replaced by `replacement`.
   */
  maskPattern?: Array<RegexSource & { replacement: string }>;
}

/**
 * Per-signal attribute redaction rules applied before export.
 *
 * Spans and logs have independent rule sets; metrics are out of v1 scope.
 * Omitting `attributeRedactions` (or any nested key) means no redaction is
 * applied to that signal.
 */
export interface AttributeRedactions {
  spans?: RedactionRules;
  logs?: RedactionRules;
}

/**
 * A rule for ignoring spans by name. Either an exact string match or a
 * serialisable regex source.
 */
export type IgnoreSpanRule = string | RegexSource;

/**
 * A rule for ignoring log records. A record is dropped if ANY rule matches:
 * - `name` matches the record's event name (exact or regex)
 * - the record's severity is below `minSeverity`
 *
 * Filters run after sampling at the apm-agent-ios level — do not use these
 * as a sampling mechanism.
 */
export interface IgnoreLogRule {
  name?: string | RegexSource;
  minSeverity?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

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

  /**
   * Drop or mask span / log attributes before export.
   * Metrics are not in scope for v1.
   */
  attributeRedactions?: AttributeRedactions;

  /**
   * Drop entire spans whose name matches any rule.
   * Supports exact strings and serialisable regex sources.
   * Filters run after sampling at the apm-agent-ios level.
   */
  ignoreSpanNames?: IgnoreSpanRule[];

  /**
   * Drop entire log records matching any rule.
   * A record is dropped if ANY rule matches (name OR minSeverity).
   * Filters run after sampling at the apm-agent-ios level.
   */
  ignoreLogPatterns?: IgnoreLogRule[];

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
