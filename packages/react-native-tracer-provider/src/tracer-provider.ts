import type {
  TracerProvider,
  Tracer,
  Span,
  SpanOptions,
  SpanStatusCodeValue,
} from './types';

interface NativeModule {
  startSpan(
    name: string,
    attributes: Record<string, string | number | boolean>,
    parentSpanId: string | null,
  ): string;
  endSpan(spanId: string, statusCode: number): void;
  setSpanAttribute(spanId: string, key: string, value: string): void;
  setSpanAttributeNumber(spanId: string, key: string, value: number): void;
  setSpanAttributeBoolean(spanId: string, key: string, value: boolean): void;
  recordSpanException(spanId: string, errorInfo: Record<string, string>): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox/react-native-edot-sdk/nativeModule') as {
      EdotNativeModule: NativeModule;
    };
    nativeModule = mod.EdotNativeModule;
  }
  return nativeModule;
}

const contextStack: Span[] = [];

function currentContextParent(): Span | null {
  return contextStack[contextStack.length - 1] ?? null;
}

function createSpan(
  name: string,
  attributes: Record<string, string | number | boolean>,
  parentSpanId: string | null,
): Span {
  const native = getNativeModule();
  const spanId = native.startSpan(name, attributes, parentSpanId);
  let ended = false;
  let statusCode = 1;

  const span: Span = {
    get spanId() {
      return spanId;
    },

    setAttribute(key: string, value: string | number | boolean): void {
      if (ended) return;
      if (typeof value === 'number') {
        native.setSpanAttributeNumber(spanId, key, value);
      } else if (typeof value === 'boolean') {
        native.setSpanAttributeBoolean(spanId, key, value);
      } else {
        native.setSpanAttribute(spanId, key, value);
      }
    },

    setStatus(code: SpanStatusCodeValue): void {
      if (ended) return;
      statusCode = code;
    },

    recordException(error: Error): void {
      if (ended) return;
      native.recordSpanException(spanId, {
        name: error.name,
        message: error.message,
        stack: error.stack ?? '',
      });
    },

    end(): void {
      if (ended) return;
      ended = true;
      native.endSpan(spanId, statusCode);
    },
  };

  return span;
}

function createTracer(_name: string, _version?: string): Tracer {
  return {
    startSpan(name: string, options?: SpanOptions): Span {
      const attrs: Record<string, string | number | boolean> = {};
      if (options?.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          attrs[key] = value;
        }
      }

      const parentSpanId = options?.parentSpan?.spanId ?? currentContextParent()?.spanId ?? null;

      return createSpan(name, attrs, parentSpanId);
    },
  };
}

let tracerProviderInstance: TracerProvider | null = null;

export function getTracerProvider(): TracerProvider {
  if (!tracerProviderInstance) {
    tracerProviderInstance = {
      getTracer(name: string, version?: string): Tracer {
        return createTracer(name, version);
      },
    };
  }
  return tracerProviderInstance;
}

/**
 * Sets an implicit parent span for synchronous `fn`. Supports async `fn` but
 * concurrent async calls may interleave — pass `parentSpan` explicitly via
 * `SpanOptions` for async code.
 */
export function withSpanContext<T>(parentSpan: Span, fn: () => T): T {
  contextStack.push(parentSpan);
  const expectedTop = parentSpan;
  try {
    return fn();
  } finally {
    const top = contextStack[contextStack.length - 1];
    if (top !== expectedTop) {
      console.warn(
        '[EDOT] withSpanContext stack mismatch — use explicit parentSpan for async fn',
      );
      const idx = contextStack.lastIndexOf(expectedTop);
      if (idx !== -1) {
        contextStack.splice(idx, 1);
      }
    } else {
      contextStack.pop();
    }
  }
}

export function resetForTesting(): void {
  tracerProviderInstance = null;
  contextStack.length = 0;
  nativeModule = null;
}

/** Exposed only for testing the mismatch-detection branch. */
export function __test_pushContextStack(span: Span): void {
  contextStack.push(span);
}
