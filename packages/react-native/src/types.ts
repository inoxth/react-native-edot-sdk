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
