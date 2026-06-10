/* oxlint-disable no-wrapper-object-types -- RN codegen requires capital Object for dictionary-shaped params; lowercase `object` (TSObjectKeyword) throws UnsupportedTypeAnnotationParserError. */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  initialize(config: Object): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  reportJsException(errorInfo: Object): void;
  startSpan(
    name: string,
    attributes: Object,
    parentSpanId?: string | null,
    instrumentationName?: string | null,
  ): string;
  startClientSpan(
    name: string,
    attributes: Object,
    parentSpanId?: string | null,
    instrumentationName?: string | null,
  ): string;
  getTraceparent(spanHandle: string): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  setSpanAttributeNumber(spanId: string, key: string, value: number): void;
  setSpanAttributeBoolean(spanId: string, key: string, value: boolean): void;
  recordSpanException(spanId: string, errorInfo: Object): void;
  recordMetric(name: string, value: number, attributes: Object, metricType: string): void;
  emitLog(severity: string, message: string, attributes: Object): void;
  setTrackingConsent(consent: string): void;
}

export default TurboModuleRegistry.get<Spec>('EdotReactNative');
