import { getMeterProvider, resetMeterForTesting } from '../meter-provider';

const mockNativeModule = {
  recordMetric: jest.fn(),
  startSpan: jest.fn(),
  endSpan: jest.fn(),
};

jest.mock('@inox/react-native-edot-sdk/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

describe('MeterProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMeterForTesting();
  });

  it('returns same instance on multiple calls', () => {
    expect(getMeterProvider()).toBe(getMeterProvider());
  });

  it('creates a meter', () => {
    const meter = getMeterProvider().getMeter('app-metrics', '1.0.0');
    expect(meter).toBeDefined();
  });
});

describe('Counter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMeterForTesting();
  });

  it('records counter metric via native bridge', () => {
    const meter = getMeterProvider().getMeter('test');
    const counter = meter.createCounter('cart.items_added');

    counter.add(1, { 'item.category': 'electronics' });

    expect(mockNativeModule.recordMetric).toHaveBeenCalledWith(
      'cart.items_added',
      1,
      { 'item.category': 'electronics' },
      'counter',
    );
  });

  it('works without attributes', () => {
    const meter = getMeterProvider().getMeter('test');
    const counter = meter.createCounter('requests');

    counter.add(1);

    expect(mockNativeModule.recordMetric).toHaveBeenCalledWith('requests', 1, {}, 'counter');
  });
});

describe('Histogram', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMeterForTesting();
  });

  it('records histogram metric via native bridge', () => {
    const meter = getMeterProvider().getMeter('test');
    const histogram = meter.createHistogram('api.latency_ms');

    histogram.record(145, { 'api.endpoint': '/checkout' });

    expect(mockNativeModule.recordMetric).toHaveBeenCalledWith(
      'api.latency_ms',
      145,
      { 'api.endpoint': '/checkout' },
      'histogram',
    );
  });
});

describe('UpDownCounter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMeterForTesting();
  });

  it('records upDownCounter metric via native bridge', () => {
    const meter = getMeterProvider().getMeter('test');
    const counter = meter.createUpDownCounter('active_connections');

    counter.add(-1, { 'pool': 'main' });

    expect(mockNativeModule.recordMetric).toHaveBeenCalledWith(
      'active_connections',
      -1,
      { pool: 'main' },
      'upDownCounter',
    );
  });
});

describe('Typed metric attributes (F-17)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMeterForTesting();
  });

  it('preserves number and boolean attribute types without stringifying', () => {
    const meter = getMeterProvider().getMeter('test');
    const counter = meter.createCounter('api.calls');

    counter.add(42, { userId: 'abc', count: 5, enabled: true });

    expect(mockNativeModule.recordMetric).toHaveBeenCalledWith(
      'api.calls',
      42,
      { userId: 'abc', count: 5, enabled: true },
      'counter',
    );

    const recorded: Record<string, string | number | boolean> =
      mockNativeModule.recordMetric.mock.calls[0][2];
    expect(typeof recorded['count']).toBe('number');
    expect(typeof recorded['enabled']).toBe('boolean');
    expect(typeof recorded['userId']).toBe('string');
  });
});
