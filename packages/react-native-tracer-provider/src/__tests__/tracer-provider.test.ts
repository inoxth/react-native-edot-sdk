import { getTracerProvider, withSpanContext, resetForTesting } from '../tracer-provider';
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

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith(
      'child',
      {},
      parentId,
    );
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

  it('ignores operations after end', () => {
    const tracer = getTracerProvider().getTracer('test');
    const span = tracer.startSpan('test');

    span.end();
    jest.clearAllMocks();

    span.setAttribute('key', 'value');
    span.end();

    expect(mockNativeModule.setSpanAttribute).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
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

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith(
      'child',
      {},
      parentId,
    );
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

    expect(mockNativeModule.startSpan).toHaveBeenLastCalledWith(
      'asyncChild',
      {},
      parentId,
    );
  });
});

describe('SpanStatusCode', () => {
  it('has correct values', () => {
    expect(SpanStatusCode.OK).toBe(1);
    expect(SpanStatusCode.ERROR).toBe(2);
  });
});
