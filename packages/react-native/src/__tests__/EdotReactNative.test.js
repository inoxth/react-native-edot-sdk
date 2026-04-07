import { EdotReactNative } from '../EdotReactNative';
import { EdotNativeModule } from '../nativeModule';
jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentSessionId: jest.fn().mockResolvedValue('session-123'),
    setUser: jest.fn(),
    clearUser: jest.fn(),
    setSessionAttribute: jest.fn(),
    setGlobalAttribute: jest.fn(),
    removeGlobalAttribute: jest.fn(),
    reportJsException: jest.fn(),
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    recordSpanException: jest.fn(),
    recordMetric: jest.fn(),
    emitLog: jest.fn(),
    setTrackingConsent: jest.fn(),
  },
}));
const validConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};
describe('EdotReactNative', () => {
  beforeEach(() => {
    EdotReactNative._resetForTesting();
    jest.clearAllMocks();
  });
  describe('initialize', () => {
    it('calls native module initialize', async () => {
      await EdotReactNative.initialize(validConfig);
      expect(EdotNativeModule.initialize).toHaveBeenCalledTimes(1);
    });
    it('passes merged config with defaults to native', async () => {
      await EdotReactNative.initialize(validConfig);
      const nativeConfig = EdotNativeModule.initialize.mock.calls[0][0];
      expect(nativeConfig.serverUrl).toBe('https://apm.example.com:8200');
      expect(nativeConfig.exportProtocol).toBe('otlp/http');
      expect(nativeConfig.sessionSamplingRate).toBe(1.0);
      expect(nativeConfig.debug).toBe(false);
    });
    it('warns and returns on duplicate initialize', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await EdotReactNative.initialize(validConfig);
      await EdotReactNative.initialize(validConfig);
      expect(EdotNativeModule.initialize).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[EDOT] SDK already initialized, ignoring duplicate call',
      );
      warnSpy.mockRestore();
    });
    it('throws on invalid config before calling native', async () => {
      await expect(EdotReactNative.initialize({ ...validConfig, serverUrl: '' })).rejects.toThrow(
        'serverUrl is required',
      );
      expect(EdotNativeModule.initialize).not.toHaveBeenCalled();
    });
  });
  describe('session management', () => {
    it('getCurrentSessionId delegates to native', async () => {
      const id = await EdotReactNative.getCurrentSessionId();
      expect(id).toBe('session-123');
    });
    it('setUser delegates to native', () => {
      EdotReactNative.setUser({ id: 'user-1', email: 'test@test.com' });
      expect(EdotNativeModule.setUser).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'test@test.com',
      });
    });
    it('clearUser delegates to native', () => {
      EdotReactNative.clearUser();
      expect(EdotNativeModule.clearUser).toHaveBeenCalled();
    });
  });
  describe('global attributes', () => {
    it('setGlobalAttribute delegates to native', () => {
      EdotReactNative.setGlobalAttribute('key', 'value');
      expect(EdotNativeModule.setGlobalAttribute).toHaveBeenCalledWith('key', 'value');
    });
    it('removeGlobalAttribute delegates to native', () => {
      EdotReactNative.removeGlobalAttribute('key');
      expect(EdotNativeModule.removeGlobalAttribute).toHaveBeenCalledWith('key');
    });
  });
  describe('tracking consent', () => {
    it('setTrackingConsent delegates to native', () => {
      EdotReactNative.setTrackingConsent('pending');
      expect(EdotNativeModule.setTrackingConsent).toHaveBeenCalledWith('pending');
    });
  });
});
//# sourceMappingURL=EdotReactNative.test.js.map
