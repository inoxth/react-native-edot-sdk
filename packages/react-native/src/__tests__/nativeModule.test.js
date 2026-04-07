import { NativeModules } from 'react-native';
describe('nativeModule', () => {
  beforeEach(() => {
    jest.resetModules();
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
  it('loads NativeModules when available on old architecture', () => {
    const mockModule = {
      initialize: jest.fn(),
      getCurrentSessionId: jest.fn(),
      setUser: jest.fn(),
      clearUser: jest.fn(),
      setSessionAttribute: jest.fn(),
      setGlobalAttribute: jest.fn(),
      removeGlobalAttribute: jest.fn(),
      reportJsException: jest.fn(),
      startSpan: jest.fn(),
      endSpan: jest.fn(),
      setSpanAttribute: jest.fn(),
      recordSpanException: jest.fn(),
      recordMetric: jest.fn(),
      emitLog: jest.fn(),
      setTrackingConsent: jest.fn(),
    };
    NativeModules.EdotReactNative = mockModule;
    const { EdotNativeModule } = require('../nativeModule');
    expect(EdotNativeModule).toBe(mockModule);
  });
});
//# sourceMappingURL=nativeModule.test.js.map
