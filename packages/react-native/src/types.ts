export interface EdotConfig {
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;

  secretToken?: string;
  apiKey?: string;

  exportProtocol?: 'otlp/http' | 'otlp/grpc';
  customExportHeaders?: Record<string, string>;

  sessionSamplingRate?: number;

  instrumentNetworkRequests?: boolean;
  instrumentJsErrors?: boolean;
  instrumentNativeCrashes?: boolean;
  instrumentAppLifecycle?: boolean;
  instrumentAppStartup?: boolean;

  tracePropagationTargets?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];

  ios?: EdotIosConfig;
  android?: EdotAndroidConfig;

  trackingConsent?: TrackingConsent;
  urlSanitizer?: (url: string) => string;
  requestHeadersToCapture?: string[];
  responseHeadersToCapture?: string[];

  globalAttributes?: Record<string, string | number | boolean>;

  codePushVersion?: string;

  graphqlUrls?: (string | RegExp)[];

  debug?: boolean;
  debugExportToConsole?: boolean;
}

export interface EdotIosConfig {
  enableMetricKit?: boolean;
  enableViewControllerTracing?: boolean;
}

export interface EdotAndroidConfig {
  enableAnrDetection?: boolean;
  enableSlowRenderingDetection?: boolean;
  diskBufferingEnabled?: boolean;
}

export type TrackingConsent = 'granted' | 'not_granted' | 'pending';

export interface EdotUser {
  id: string;
  email?: string;
  name?: string;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
}
