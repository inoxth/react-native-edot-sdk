/**
 * Serialisable regex pattern — used in place of a `RegExp` object so the
 * config can cross the React Native bridge without loss.
 */
export interface RegexSource {
  source: string;
  flags?: string;
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
  /**
   * Service name reported on the OTel `Resource` (`service.name`).
   *
   * Optional at the type level: validation requires that **either** this
   * top-level value **or** the active platform's override
   * (`ios.serviceName` / `android.serviceName`) resolves to a non-empty
   * string with no `,` or `=` characters. The per-platform override wins
   * when both are present.
   */
  serviceName?: string;
  serviceVersion: string;
  deploymentEnvironment: string;

  secretToken?: string;
  apiKey?: string;

  /**
   * OTLP transport protocol for traces, metrics, and logs.
   *
   * Defaults to `'http'` on both iOS and Android. We override the upstream
   * default — `apm-agent-ios` defaults to gRPC and `apm-agent-android`
   * defaults to HTTP — so the same omitted-config produces the same
   * transport on both platforms. Set explicitly when you need gRPC.
   *
   * - `'http'` — OTLP/HTTP-protobuf, posts to `<serverUrl>/v1/{traces,metrics,logs}`.
   *   Easier to proxy / load-balance.
   * - `'grpc'` — OTLP/gRPC over HTTP/2 (same port). Requires server-side
   *   gRPC support; on Android the OkHttp sender handles HTTP/2 negotiation.
   */
  exportProtocol?: 'http' | 'grpc';

  sessionSamplingRate?: number;

  instrumentNetworkRequests?: boolean;
  instrumentJsErrors?: boolean;
  instrumentAppStartup?: boolean;
  appStateTracking?: boolean;

  /**
   * Controls which outbound URLs receive a W3C `traceparent` header for
   * distributed tracing.
   *
   * - Omit (`undefined`): inject `traceparent` on **all** outbound HTTP
   *   requests, excluding the EDOT server URL and any `ignoreUrls` matches.
   *   Matches the iOS `apm-agent-ios` default.
   * - `[]` (empty array): explicit opt-out — never inject `traceparent`.
   * - Array of `string | RegExp`: allowlist — inject only when the URL matches
   *   a pattern. Strings use `url.includes(pattern)`; RegExps use
   *   `pattern.test(url)`.
   *
   * @default undefined (propagate to all)
   */
  tracePropagationTargets?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];

  trackingConsent?: TrackingConsent;
  urlSanitizer?: (url: string) => string;

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
   * Enables the `application.launch.time` histogram. Defaults to `true`.
   * Set to `false` to skip installing the launch-time instrumentation.
   *
   * Implemented natively on both platforms (iOS via MetricKit, Android via
   * Choreographer + Process.getStartUptimeMillis).
   */
  enableAppMetricInstrumentation?: boolean;

  /**
   * Enables the `system.cpu.usage` and `system.memory.usage` observable
   * gauges. Defaults to `true`. Set to `false` to skip installing the
   * system-metrics instrumentation.
   *
   * Implemented natively on both platforms (iOS via Mach task APIs,
   * Android via Process.getElapsedCpuTime and Debug.MemoryInfo).
   */
  enableSystemMetrics?: boolean;

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
  /**
   * iOS-only override for `serviceName`. When set, replaces the top-level
   * `serviceName` in the OTel `Resource` on iOS.
   */
  serviceName?: string;
  enableCrashReporting?: boolean;
  enableURLSessionInstrumentation?: boolean;
  enableViewControllerInstrumentation?: boolean;
  enableLifecycleEvents?: boolean;
}

export interface EdotAndroidConfig {
  /**
   * Android-only override for `serviceName`. When set, replaces the
   * top-level `serviceName` in the OTel `Resource` on Android.
   */
  serviceName?: string;
  diskBufferingEnabled?: boolean;
}

export type TrackingConsent = 'granted' | 'not_granted' | 'pending';
