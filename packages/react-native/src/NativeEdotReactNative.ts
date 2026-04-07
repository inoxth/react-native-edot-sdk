import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  initialize(config: Object): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  setUser(userInfo: Object): void;
  clearUser(): void;
  setSessionAttribute(key: string, value: string): void;
  setGlobalAttribute(key: string, value: string): void;
  removeGlobalAttribute(key: string): void;
  reportJsException(errorInfo: Object): void;
  startSpan(name: string, attributes: Object, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  recordSpanException(spanId: string, errorInfo: Object): void;
  recordMetric(name: string, value: number, attributes: Object, metricType: string): void;
  emitLog(severity: string, message: string, attributes: Object): void;
  setTrackingConsent(consent: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EdotReactNative');
