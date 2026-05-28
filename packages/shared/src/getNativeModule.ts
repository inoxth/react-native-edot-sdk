export interface EdotNativeModule {
  initialize(config: Record<string, unknown>): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  setUser(userInfo: Record<string, unknown>): void;
  clearUser(): void;
  setSessionAttribute(key: string, value: string): void;
  setGlobalAttribute(key: string, value: string): void;
  removeGlobalAttribute(key: string): void;
  reportJsException(errorInfo: Record<string, unknown>): void;
  startSpan(
    name: string,
    attributes: Record<string, string | number | boolean>,
    parentSpanId?: string | null,
    instrumentationName?: string | null,
  ): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  setSpanAttributeNumber(spanId: string, key: string, value: number): void;
  setSpanAttributeBoolean(spanId: string, key: string, value: boolean): void;
  recordSpanException(spanId: string, errorInfo: Record<string, string>): void;
  recordMetric(
    name: string,
    value: number,
    attributes: Record<string, string | number | boolean>,
    metricType: string,
  ): void;
  emitLog(severity: string, message: string, attributes: Record<string, unknown>): void;
  setTrackingConsent(consent: string): void;
}

const REQUIRED_METHODS: ReadonlyArray<keyof EdotNativeModule> = ['startSpan', 'endSpan'];

function isEdotNativeModule(x: unknown): x is EdotNativeModule {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  return REQUIRED_METHODS.every((method) => typeof obj[method] === 'function');
}

let cachedModule: EdotNativeModule | null = null;

export function getNativeModule(): EdotNativeModule {
  if (cachedModule !== null) return cachedModule;

  const mod: unknown = require('@inoxth/react-native-edot-sdk/nativeModule');
  const candidate =
    typeof mod === 'object' && mod !== null && 'EdotNativeModule' in mod
      ? (mod as Record<string, unknown>).EdotNativeModule
      : undefined;

  if (!isEdotNativeModule(candidate)) {
    const missing = REQUIRED_METHODS.filter((m) => {
      const entry =
        candidate !== undefined && typeof candidate === 'object' && candidate !== null
          ? (candidate as Record<string, unknown>)[m]
          : undefined;
      return typeof entry !== 'function';
    });
    console.warn(`[EDOT] EdotNativeModule missing expected methods: ${missing.join(', ')}`);
    throw new Error(`EdotNativeModule missing expected methods: ${missing.join(', ')}`);
  }

  cachedModule = candidate;
  return cachedModule;
}

export function resetNativeModuleCacheForTesting(): void {
  cachedModule = null;
}
