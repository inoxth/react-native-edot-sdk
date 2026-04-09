import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  initialize(config: object): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  setUser(userInfo: object): void;
  clearUser(): void;
  setSessionAttribute(key: string, value: string): void;
  setGlobalAttribute(key: string, value: string): void;
  removeGlobalAttribute(key: string): void;
  reportJsException(errorInfo: object): void;
  startSpan(name: string, attributes: object, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  recordSpanException(spanId: string, errorInfo: object): void;
  recordMetric(name: string, value: number, attributes: object, metricType: string): void;
  emitLog(severity: string, message: string, attributes: object): void;
  setTrackingConsent(consent: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EdotReactNative');
