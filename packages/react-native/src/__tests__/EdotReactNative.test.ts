import { EdotReactNative } from '../EdotReactNative';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../instrumentation/fetch', () => ({
  setupFetchInstrumentation: jest.fn(() => jest.fn()),
}));
jest.mock('../instrumentation/xhr', () => ({ setupXhrInstrumentation: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/errors', () => ({ setupErrorHandler: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/startup', () => ({ setupStartupTracing: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/spanCleanup', () => ({ setupSpanCleanup: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/app-state', () => ({
  setupAppStateTracking: jest.fn(() => jest.fn()),
}));

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentSessionId: jest.fn().mockResolvedValue('session-123'),
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
  },
}));

const validConfig: EdotConfig = {
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

      const nativeConfig = (EdotNativeModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.serverUrl).toBe('https://apm.example.com:8200');
      expect(nativeConfig.sessionSamplingRate).toBeUndefined();
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

    it('concurrent initialize calls only call native module once', async () => {
      const [p1, p2] = await Promise.all([
        EdotReactNative.initialize(validConfig),
        EdotReactNative.initialize(validConfig),
      ]).then((results) => results);

      expect(p1).toBeUndefined();
      expect(p2).toBeUndefined();
      expect(EdotNativeModule.initialize).toHaveBeenCalledTimes(1);
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
  });

  describe('tracking consent', () => {
    it('setTrackingConsent delegates to native', () => {
      EdotReactNative.setTrackingConsent('pending');
      expect(EdotNativeModule.setTrackingConsent).toHaveBeenCalledWith('pending');
    });
  });

  describe('log', () => {
    it('passes string attributes to native emitLog', () => {
      EdotReactNative.log('info', 'hello', { key: 'value' });
      expect(EdotNativeModule.emitLog).toHaveBeenCalledWith('info', 'hello', { key: 'value' });
    });

    it('passes numeric attributes to native emitLog', () => {
      EdotReactNative.log('info', 'Order placed', { 'order.total': 49.99, 'order.count': 3 });
      expect(EdotNativeModule.emitLog).toHaveBeenCalledWith('info', 'Order placed', {
        'order.total': 49.99,
        'order.count': 3,
      });
    });

    it('passes boolean attributes to native emitLog', () => {
      EdotReactNative.log('info', 'Order placed', { 'order.is_first': true });
      expect(EdotNativeModule.emitLog).toHaveBeenCalledWith('info', 'Order placed', {
        'order.is_first': true,
      });
    });

    it('passes mixed typed attributes to native emitLog', () => {
      EdotReactNative.log('info', 'Order placed', {
        'order.id': 'ord-123',
        'order.total': 49.99,
        'order.is_first': true,
      });
      expect(EdotNativeModule.emitLog).toHaveBeenCalledWith('info', 'Order placed', {
        'order.id': 'ord-123',
        'order.total': 49.99,
        'order.is_first': true,
      });
    });

    it('passes empty attributes when none provided', () => {
      EdotReactNative.log('error', 'Something failed');
      expect(EdotNativeModule.emitLog).toHaveBeenCalledWith('error', 'Something failed', {});
    });
  });

  describe('platform config', () => {
    it('spreads ios config into nativeConfig on iOS', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        enableSystemMetrics: false,
        ios: {
          enableCrashReporting: false,
        },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.enableCrashReporting).toBe(false);
      expect(nativeConfig.enableSystemMetrics).toBe(false);
    });

    it('spreads android config into nativeConfig on Android', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        android: {
          diskBufferingEnabled: true,
        },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.diskBufferingEnabled).toBe(true);
    });

    it('does not include ios config on Android', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        ios: { enableCrashReporting: true },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.enableCrashReporting).toBeUndefined();
    });

    it('ios.serviceName overrides top-level serviceName in the bridge payload on iOS', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        serviceName: 'myapp',
        ios: { serviceName: 'myapp-ios' },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.serviceName).toBe('myapp-ios');
    });

    it('android.serviceName is ignored on iOS; top-level wins', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        serviceName: 'myapp',
        android: { serviceName: 'myapp-android' },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.serviceName).toBe('myapp');
    });

    it('forwards top-level exportProtocol to native on both platforms', async () => {
      await EdotReactNative.initialize({ ...validConfig, exportProtocol: 'grpc' });

      const nativeConfig = (EdotNativeModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.exportProtocol).toBe('grpc');
    });

    it('forwards ios.useOpAMP to native when true', async () => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
      jest.resetModules();

      const { EdotReactNative: Fresh } = require('../EdotReactNative');
      Fresh._resetForTesting();

      await Fresh.initialize({
        ...validConfig,
        ios: { useOpAMP: true },
      });

      const { EdotNativeModule: MockModule } = require('../nativeModule');
      const nativeConfig = (MockModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.useOpAMP).toBe(true);
    });

    it('only sends optional fields when explicitly set', async () => {
      await EdotReactNative.initialize(validConfig);

      const nativeConfig = (EdotNativeModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.sessionSamplingRate).toBeUndefined();
      expect(nativeConfig.trackingConsent).toBeUndefined();
      expect(nativeConfig.secretToken).toBeUndefined();
      expect(nativeConfig.apiKey).toBeUndefined();
    });

    it('sends optional fields when set', async () => {
      await EdotReactNative.initialize({
        ...validConfig,
        sessionSamplingRate: 0.5,
        secretToken: 'tok',
      });

      const nativeConfig = (EdotNativeModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.sessionSamplingRate).toBe(0.5);
      expect(nativeConfig.secretToken).toBe('tok');
    });

    it('forwards trackingConsent to native when set', async () => {
      await EdotReactNative.initialize({ ...validConfig, trackingConsent: 'not_granted' });

      const nativeConfig = (EdotNativeModule.initialize as jest.Mock).mock.calls[0][0];
      expect(nativeConfig.trackingConsent).toBe('not_granted');
    });
  });
});
