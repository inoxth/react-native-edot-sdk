export const SpanStatusCode = {
  OK: 1,
  ERROR: 2,
} as const;

export type SpanStatusCodeValue = (typeof SpanStatusCode)[keyof typeof SpanStatusCode];

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  parentSpan?: Span;
}

export interface Span {
  readonly spanId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: SpanStatusCodeValue): void;
  recordException(error: Error): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, options?: SpanOptions): Span;
}

export interface TracerProvider {
  getTracer(name: string, version?: string): Tracer;
}

export interface Counter {
  add(value: number, attributes?: Record<string, string | number | boolean>): void;
}

export interface Histogram {
  record(value: number, attributes?: Record<string, string | number | boolean>): void;
}

export interface UpDownCounter {
  add(value: number, attributes?: Record<string, string | number | boolean>): void;
}

export interface Meter {
  createCounter(name: string): Counter;
  createHistogram(name: string): Histogram;
  createUpDownCounter(name: string): UpDownCounter;
}

export interface MeterProvider {
  getMeter(name: string, version?: string): Meter;
}
