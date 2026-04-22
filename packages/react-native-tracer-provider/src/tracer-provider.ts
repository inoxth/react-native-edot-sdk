import { getNativeModule } from '@inox/react-native-edot-shared';
import type {
  TracerProvider,
  Tracer,
  Span,
  SpanOptions,
  SpanStatusCodeValue,
} from './types';

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
  let statusCode = 1;

  let endedAt: number | null = null;

  function warnPostEnd(method: string, detail?: string): void {
    const age = endedAt !== null ? `${Date.now() - endedAt}ms ago` : 'already ended';
    const extra = detail !== undefined ? ` (${detail})` : '';
    console.warn(
      `[EDOT] ${method} called on already-ended span "${name}" — ended ${age}${extra}; drop ignored`,
    );
  }

  const span: Span = {
    get spanId() {
      return spanId;
    },

    setAttribute(key: string, value: string | number | boolean): void {
      if (endedAt !== null) {
        warnPostEnd('setAttribute', `key="${key}"`);
        return;
      }
      if (typeof value === 'number') {
        native.setSpanAttributeNumber(spanId, key, value);
      } else if (typeof value === 'boolean') {
        native.setSpanAttributeBoolean(spanId, key, value);
      } else {
        native.setSpanAttribute(spanId, key, value);
      }
    },

    setStatus(code: SpanStatusCodeValue): void {
      if (endedAt !== null) {
        warnPostEnd('setStatus', `code=${code}`);
        return;
      }
      statusCode = code;
    },

    recordException(error: Error): void {
      if (endedAt !== null) {
        warnPostEnd('recordException', error.message);
        return;
      }
      native.recordSpanException(spanId, {
        name: error.name,
        message: error.message,
        stack: error.stack ?? '',
      });
    },

    end(): void {
      if (endedAt !== null) {
        warnPostEnd('end');
        return;
      }
      endedAt = Date.now();
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
}

/** Exposed only for testing the mismatch-detection branch. */
export function __test_pushContextStack(span: Span): void {
  contextStack.push(span);
}
