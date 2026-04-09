export interface EdotConfig {
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;

  secretToken?: string;
  apiKey?: string;

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

  graphqlUrls?: (string | RegExp)[];

  debug?: boolean;

  ios?: EdotIosConfig;
  android?: EdotAndroidConfig;
}

export interface EdotIosConfig {
  connectionType?: 'grpc' | 'http';
  enableCrashReporting?: boolean;
  enableURLSessionInstrumentation?: boolean;
  enableViewControllerInstrumentation?: boolean;
  enableAppMetricInstrumentation?: boolean;
  enableSystemMetrics?: boolean;
  enableLifecycleEvents?: boolean;
}

export interface EdotAndroidConfig {
  exportProtocol?: 'http' | 'grpc';
  diskBufferingEnabled?: boolean;
}

export type TrackingConsent = 'granted' | 'not_granted' | 'pending';

export interface EdotUser {
  id: string;
  email?: string;
  name?: string;
}
