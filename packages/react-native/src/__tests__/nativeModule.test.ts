import { NativeModules } from 'react-native';

describe('nativeModule', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.unmock('../NativeEdotReactNative');

    delete global.__turboModuleProxy;
    NativeModules.EdotReactNative = undefined;
  });

  it('returns no-op module when native module is not linked', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');

    expect(EdotNativeModule).toBeDefined();
    const result = EdotNativeModule.startSpan('test', {}, null);
    expect(result).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Native module not found'));

    warnSpy.mockRestore();
  });

  it('no-op module only warns once', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');
    EdotNativeModule.startSpan('test1', {}, null);
    EdotNativeModule.startSpan('test2', {}, null);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  // F-32: one-shot warn across N accesses — operators see exactly one signal
  it('F-32: no-op Proxy warns exactly once across many property accesses', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');

    for (let i = 0; i < 10; i++) {
      EdotNativeModule.startSpan(`span-${i}`, {}, null);
    }
    EdotNativeModule.endSpan('', 1);
    EdotNativeModule.setSpanAttribute('', 'k', 'v');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Native module not found'));
    warnSpy.mockRestore();
  });

  it('no-op initialize resolves without error', async () => {
    jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');
    await expect(EdotNativeModule.initialize({})).resolves.toBeUndefined();
  });

  it('no-op getCurrentSessionId returns empty string', async () => {
    jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');
    const sessionId = await EdotNativeModule.getCurrentSessionId();
    expect(sessionId).toBe('');
  });

  it('warns and falls back when TurboModule require throws non-not-found error', () => {
    jest.doMock('../NativeEdotReactNative', () => {
      throw new Error('TurboModule spec broken');
    });

    const fallback = { startSpan: jest.fn(), endSpan: jest.fn() };
    NativeModules.EdotReactNative = fallback;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { EdotNativeModule } = require('../nativeModule');

    expect(warnSpy).toHaveBeenCalledWith(
      '[EDOT] TurboModule load failed, falling back to NativeModules:',
      expect.any(Error),
    );
    // EdotNativeModule is a wrapper — verify wrapper delegates to fallback
    expect(EdotNativeModule.endSpan).toBe(fallback.endSpan);

    warnSpy.mockRestore();
    jest.dontMock('../NativeEdotReactNative');
  });

  it('loads NativeModules when available on old architecture', () => {
    const mockModule = {
      initialize: jest.fn(),
      getCurrentSessionId: jest.fn(),
      reportJsException: jest.fn(),
      startSpan: jest.fn().mockReturnValue('span-1'),
      endSpan: jest.fn(),
      setSpanAttribute: jest.fn(),
      setSpanAttributeNumber: jest.fn(),
      setSpanAttributeBoolean: jest.fn(),
      recordSpanException: jest.fn(),
      recordMetric: jest.fn(),
      emitLog: jest.fn(),
      setTrackingConsent: jest.fn(),
    };

    NativeModules.EdotReactNative = mockModule;

    const { EdotNativeModule } = require('../nativeModule');
    // EdotNativeModule is now a wrapper, not the raw module
    expect(EdotNativeModule.initialize).toBe(mockModule.initialize);
    expect(EdotNativeModule.endSpan).toBe(mockModule.endSpan);
  });

  // F-25: TurboModule loaded without relying on __turboModuleProxy
  it('loads TurboModule directly without requiring __turboModuleProxy', () => {
    // No __turboModuleProxy set — new implementation tries require() directly
    const turboModule = { startSpan: jest.fn().mockReturnValue('span-1'), endSpan: jest.fn() };
    jest.doMock('../NativeEdotReactNative', () => ({ default: turboModule }));

    const { EdotNativeModule } = require('../nativeModule');

    // EdotNativeModule is a wrapper — verify delegated methods
    expect(EdotNativeModule.endSpan).toBe(turboModule.endSpan);

    jest.dontMock('../NativeEdotReactNative');
  });

  // F-25: module-not-found errors fall through silently to NativeModules
  it('silently falls through to NativeModules when TurboModule is not found', () => {
    const notFound = new Error("Cannot find module './NativeEdotReactNative'");
    jest.doMock('../NativeEdotReactNative', () => {
      throw notFound;
    });

    const fallback = { startSpan: jest.fn().mockReturnValue('span-1'), endSpan: jest.fn() };
    NativeModules.EdotReactNative = fallback;

    const { EdotNativeModule } = require('../nativeModule');

    // EdotNativeModule is a wrapper — verify delegated methods
    expect(EdotNativeModule.endSpan).toBe(fallback.endSpan);

    jest.dontMock('../NativeEdotReactNative');
  });

  // F-25: TurboModule methods live on the prototype, not as own properties.
  // Object spread ({...module}) silently drops them. This test guards against
  // regressing to spread by using a class instance whose methods are on the prototype.
  it('preserves all Spec methods from prototype-based TurboModule instances', () => {
    class FakeTurboModule {
      initialize = jest.fn().mockResolvedValue(undefined);
      getCurrentSessionId = jest.fn().mockResolvedValue('');
      reportJsException = jest.fn();
      startSpan = jest.fn().mockReturnValue('span-1');
      endSpan = jest.fn();
      setSpanAttribute = jest.fn();
      setSpanAttributeNumber = jest.fn();
      setSpanAttributeBoolean = jest.fn();
      recordSpanException = jest.fn();
      recordMetric = jest.fn();
      emitLog = jest.fn();
      setTrackingConsent = jest.fn();
    }
    const turboModule = new FakeTurboModule();
    jest.doMock('../NativeEdotReactNative', () => ({ default: turboModule }));

    const { EdotNativeModule } = require('../nativeModule');

    // Verify wrapper intercepts startSpan (always 4-arg with empty-string sentinels)
    EdotNativeModule.startSpan('test', {}, null);
    expect(turboModule.startSpan).toHaveBeenCalledWith('test', {}, '', '');

    // Verify ALL other Spec methods remain accessible (not dropped by spread)
    expect(EdotNativeModule.initialize).toBe(turboModule.initialize);
    expect(EdotNativeModule.getCurrentSessionId).toBe(turboModule.getCurrentSessionId);
    expect(EdotNativeModule.reportJsException).toBe(turboModule.reportJsException);
    expect(EdotNativeModule.endSpan).toBe(turboModule.endSpan);
    expect(EdotNativeModule.setSpanAttribute).toBe(turboModule.setSpanAttribute);
    expect(EdotNativeModule.setSpanAttributeNumber).toBe(turboModule.setSpanAttributeNumber);
    expect(EdotNativeModule.setSpanAttributeBoolean).toBe(turboModule.setSpanAttributeBoolean);
    expect(EdotNativeModule.recordSpanException).toBe(turboModule.recordSpanException);
    expect(EdotNativeModule.recordMetric).toBe(turboModule.recordMetric);
    expect(EdotNativeModule.emitLog).toBe(turboModule.emitLog);
    expect(EdotNativeModule.setTrackingConsent).toBe(turboModule.setTrackingConsent);

    jest.dontMock('../NativeEdotReactNative');
  });

  describe('startSpan wrapper', () => {
    function makeFullModule(startSpan: jest.Mock): Record<string, jest.Mock> {
      return {
        initialize: jest.fn(),
        getCurrentSessionId: jest.fn(),
        reportJsException: jest.fn(),
        startSpan,
        endSpan: jest.fn(),
        setSpanAttribute: jest.fn(),
        setSpanAttributeNumber: jest.fn(),
        setSpanAttributeBoolean: jest.fn(),
        recordSpanException: jest.fn(),
        recordMetric: jest.fn(),
        emitLog: jest.fn(),
        setTrackingConsent: jest.fn(),
      };
    }

    it('passes empty-string sentinels for parentSpanId and instrumentationName when null', () => {
      const mockStartSpan = jest.fn().mockReturnValue('span-1');
      NativeModules.EdotReactNative = makeFullModule(mockStartSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startSpan('test', {}, null);

      expect(mockStartSpan).toHaveBeenCalledTimes(1);
      expect(mockStartSpan).toHaveBeenCalledWith('test', {}, '', '');
      expect(result).toBe('span-1');
    });

    it('forwards parentSpanId and uses empty instrumentationName when only parent provided', () => {
      const mockStartSpan = jest.fn().mockReturnValue('span-2');
      NativeModules.EdotReactNative = makeFullModule(mockStartSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startSpan('child', { key: 'val' }, 'parent-id');

      expect(mockStartSpan).toHaveBeenCalledWith('child', { key: 'val' }, 'parent-id', '');
      expect(result).toBe('span-2');
    });

    it('passes empty-string sentinels when both parentSpanId and instrumentationName are undefined', () => {
      const mockStartSpan = jest.fn().mockReturnValue('span-3');
      NativeModules.EdotReactNative = makeFullModule(mockStartSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startSpan('test', {});

      expect(mockStartSpan).toHaveBeenCalledWith('test', {}, '', '');
      expect(result).toBe('span-3');
    });

    it('forwards instrumentationName with empty parentSpanId when only scope provided', () => {
      const mockStartSpan = jest.fn().mockReturnValue('span-4');
      NativeModules.EdotReactNative = makeFullModule(mockStartSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startSpan('scoped', {}, null, '@inoxth/scope');

      expect(mockStartSpan).toHaveBeenCalledWith('scoped', {}, '', '@inoxth/scope');
      expect(result).toBe('span-4');
    });
  });

  describe('startClientSpan wrapper', () => {
    function makeFullModule(startClientSpan: jest.Mock): Record<string, jest.Mock> {
      return {
        initialize: jest.fn(),
        getCurrentSessionId: jest.fn(),
        reportJsException: jest.fn(),
        startSpan: jest.fn(),
        startClientSpan,
        endSpan: jest.fn(),
        setSpanAttribute: jest.fn(),
        setSpanAttributeNumber: jest.fn(),
        setSpanAttributeBoolean: jest.fn(),
        recordSpanException: jest.fn(),
        recordMetric: jest.fn(),
        emitLog: jest.fn(),
        setTrackingConsent: jest.fn(),
      };
    }

    it('passes empty-string sentinels for parentSpanId and instrumentationName when null', () => {
      const mockStartClientSpan = jest.fn().mockReturnValue('client-1');
      NativeModules.EdotReactNative = makeFullModule(mockStartClientSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startClientSpan(
        'GET api.example.com',
        { 'http.method': 'GET' },
        null,
      );

      expect(mockStartClientSpan).toHaveBeenCalledTimes(1);
      expect(mockStartClientSpan).toHaveBeenCalledWith(
        'GET api.example.com',
        { 'http.method': 'GET' },
        '',
        '',
      );
      expect(result).toBe('client-1');
    });

    it('forwards parentSpanId and uses empty instrumentationName when only parent provided', () => {
      const mockStartClientSpan = jest.fn().mockReturnValue('client-2');
      NativeModules.EdotReactNative = makeFullModule(mockStartClientSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startClientSpan('GET api.example.com', {}, 'parent-id');

      expect(mockStartClientSpan).toHaveBeenCalledWith('GET api.example.com', {}, 'parent-id', '');
      expect(result).toBe('client-2');
    });

    it('passes empty-string sentinels when both parentSpanId and instrumentationName are undefined', () => {
      const mockStartClientSpan = jest.fn().mockReturnValue('client-3');
      NativeModules.EdotReactNative = makeFullModule(mockStartClientSpan);

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startClientSpan('GET api.example.com', {});

      expect(mockStartClientSpan).toHaveBeenCalledWith('GET api.example.com', {}, '', '');
      expect(result).toBe('client-3');
    });

    it('no-op fallback returns empty string when native module is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { EdotNativeModule } = require('../nativeModule');
      const result = EdotNativeModule.startClientSpan('GET api.example.com', {}, null);

      expect(result).toBe('');
      warnSpy.mockRestore();
    });
  });
});
