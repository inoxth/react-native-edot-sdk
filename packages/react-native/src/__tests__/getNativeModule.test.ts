import { getNativeModule, resetNativeModuleCacheForTesting } from '@inoxth/react-native-edot-shared';

const mockNativeModule = {
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

jest.mock('@inoxth/react-native-edot-sdk/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

describe('getNativeModule (shared helper)', () => {
  beforeEach(() => {
    resetNativeModuleCacheForTesting();
    jest.clearAllMocks();
  });

  it('happy path: returns EdotNativeModule when shape is valid', () => {
    const mod = getNativeModule();
    expect(mod).toBe(mockNativeModule);
  });

  it('caches the module after first successful call', () => {
    const first = getNativeModule();
    const second = getNativeModule();
    expect(first).toBe(second);
  });
});

describe('getNativeModule shape-mismatch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('throws and warns when required methods are missing', () => {
    jest.doMock('@inoxth/react-native-edot-sdk/nativeModule', () => ({
      EdotNativeModule: { recordMetric: jest.fn() },
    }));

    const {
      getNativeModule: fresh,
      resetNativeModuleCacheForTesting: reset,
    } = require('@inoxth/react-native-edot-shared');
    reset();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => fresh()).toThrow(/EdotNativeModule missing expected methods/);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('EdotNativeModule missing expected methods'),
    );

    warnSpy.mockRestore();
    jest.dontMock('@inoxth/react-native-edot-sdk/nativeModule');
  });

  it('throws when EdotNativeModule property is absent from export', () => {
    jest.doMock('@inoxth/react-native-edot-sdk/nativeModule', () => ({}));

    const {
      getNativeModule: fresh,
      resetNativeModuleCacheForTesting: reset,
    } = require('@inoxth/react-native-edot-shared');
    reset();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => fresh()).toThrow(/EdotNativeModule missing expected methods/);

    warnSpy.mockRestore();
    jest.dontMock('@inoxth/react-native-edot-sdk/nativeModule');
  });
});
