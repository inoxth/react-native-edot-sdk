import {
  getTracerProvider,
  withSpanContext,
  resetForTesting,
  __test_pushContextStack,
} from '../tracer-provider';
import { SpanStatusCode } from '../types';

let spanCounter = 0;
const mockNativeModule = {
  startSpan: jest.fn().mockImplementation(() => `span-${++spanCounter}`),
  endSpan: jest.fn(),
  setSpanAttribute: jest.fn(),
  setSpanAttributeNumber: jest.fn(),
  setSpanAttributeBoolean: jest.fn(),
  recordSpanException: jest.fn(),
};

jest.mock('@inox/react-native-edot-sdk/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

describe('TracerProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spanCounter = 0;
    resetForTesting();
  });

  it('returns a TracerProvider with getTracer', () => {
    const provider = getTracerProvider();
    const tracer = provider.getTracer('checkout', '1.0.0');

    expect(tracer).toBeDefined();
    expect(tracer.startSpan).toBeInstanceOf(Function);
  });

  it('returns same instance on multiple calls', () => {
    expect(getTracerProvider()).toBe(getTracerProvider());
  });
});

describe('Tracer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spanCounter = 0;
    resetForTesting();
  });

  it('creates a span via native bridge', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('processPayment', {
      attributes: { 'payment.method': 'credit_card' },
    });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'processPayment',
      { 'payment.method': 'credit_card' },
      null,
    );
    expect(span.spanId).toBe('span-1');
  });

  it('creates a span with parent', () => {
    const tracer = getTracerProvider().getTracer('test');
    const parent = tracer.startSpan('parent');
    const parentId = parent.spanId;

    tracer.startSpan('child', { parentSpan: parent });

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith('child', {}, parentId);
  });
});

describe('Span', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spanCounter = 0;
    resetForTesting();
  });

  it('sets attributes', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.setAttribute('key', 'value');

    expect(mockNativeModule.setSpanAttribute).toHaveBeenCalledWith(span.spanId, 'key', 'value');
  });

  it('records exceptions', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.recordException(new Error('Payment failed'));

    expect(mockNativeModule.recordSpanException).toHaveBeenCalledWith(span.spanId, {
      name: 'Error',
      message: 'Payment failed',
      stack: expect.any(String),
    });
  });

  it('ends with status OK by default', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.end();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith(span.spanId, 1);
  });

  it('ends with ERROR status when set', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.setStatus(SpanStatusCode.ERROR);
    span.end();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith(span.spanId, 2);
  });

  it('ignores operations after end and warns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.end();
    jest.clearAllMocks();

    span.setAttribute('key', 'value');
    span.end();

    expect(mockNativeModule.setSpanAttribute).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('warns on recordException after end and skips native call (F-28)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('checkout');

    span.end();
    jest.clearAllMocks();

    const err = new Error('Payment declined');
    span.recordException(err);

    expect(mockNativeModule.recordSpanException).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/recordException/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/checkout/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/Payment declined/);
    warnSpy.mockRestore();
  });

  it('warns on setAttribute after end and skips native call (F-28)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('checkout');

    span.end();
    jest.clearAllMocks();

    span.setAttribute('user.id', 'u-42');

    expect(mockNativeModule.setSpanAttribute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/setAttribute/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/checkout/);
    warnSpy.mockRestore();
  });

  it('warns on setStatus after end and skips update (F-28)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('checkout');

    span.end();
    jest.clearAllMocks();

    span.setStatus(SpanStatusCode.ERROR);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/setStatus/);
    warnSpy.mockRestore();
  });

  it('warn message includes "ended … ago" timestamp context (F-28)', () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('payment');

    span.end();
    jest.advanceTimersByTime(50);

    span.recordException(new Error('oops'));

    expect(warnSpy.mock.calls[0][0]).toMatch(/\d+ms ago/);
    warnSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('withSpanContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spanCounter = 0;
    resetForTesting();
  });

  it('auto-parents spans to context parent', () => {
    const tracer = getTracerProvider().getTracer('test');
    const parent = tracer.startSpan('parent');
    const parentId = parent.spanId;

    withSpanContext(parent, () => {
      tracer.startSpan('child');
    });

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith('child', {}, parentId);
  });

  it('restores previous context after execution', () => {
    const tracer = getTracerProvider().getTracer('test');
    const parent = tracer.startSpan('parent');

    withSpanContext(parent, () => {
      // Inside context
    });

    tracer.startSpan('after');

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith('after', {}, null);
  });

  it('works with async functions', async () => {
    const tracer = getTracerProvider().getTracer('test');
    const parent = tracer.startSpan('parent');
    const parentId = parent.spanId;

    await withSpanContext(parent, async () => {
      tracer.startSpan('asyncChild');
    });

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith('asyncChild', {}, parentId);
  });

  it('two concurrent async calls do not corrupt each other — stack empty after each suspends', async () => {
    const tracer = getTracerProvider().getTracer('test');
    const spanA = tracer.startSpan('A');
    const spanB = tracer.startSpan('B');

    // Async fn's finally fires synchronously when fn() first suspends (returns Promise).
    // The stack is already popped before the awaited continuation runs, so
    // spans created after an await have no implicit parent — but neither call
    // corrupts the other's context.
    const results: Array<{ name: string; parentId: string | null }> = [];

    const taskA = withSpanContext(spanA, async () => {
      await Promise.resolve();
      const child = tracer.startSpan('childA');
      results.push({
        name: 'childA',
        parentId: mockNativeModule.startSpan.mock.lastCall?.[2] ?? null,
      });
      child.end();
    });

    const taskB = withSpanContext(spanB, async () => {
      await Promise.resolve();
      const child = tracer.startSpan('childB');
      results.push({
        name: 'childB',
        parentId: mockNativeModule.startSpan.mock.lastCall?.[2] ?? null,
      });
      child.end();
    });

    await Promise.all([taskA, taskB]);

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.parentId).toBeNull();
    }
  });

  it('warns on stack mismatch and splices out the stale entry', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracer = getTracerProvider().getTracer('test');
    const spanA = tracer.startSpan('A');
    const spanB = tracer.startSpan('B');

    // Simulate async interleave: spanB is pushed onto the stack while spanA's
    // fn is executing. When spanA's finally runs, top is spanB — mismatch.
    // spanA is spliced out; spanB remains for its own context's cleanup.
    withSpanContext(spanA, () => {
      __test_pushContextStack(spanB);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[EDOT] withSpanContext stack mismatch — use explicit parentSpan for async fn',
    );

    // spanA was removed; spanB is still the active context
    tracer.startSpan('child-of-B');
    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith('child-of-B', {}, spanB.spanId);

    warnSpy.mockRestore();
  });
});

describe('SpanStatusCode', () => {
  it('has correct values', () => {
    expect(SpanStatusCode.OK).toBe(1);
    expect(SpanStatusCode.ERROR).toBe(2);
  });
});
