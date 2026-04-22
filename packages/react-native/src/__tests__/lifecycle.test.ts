import { AppState } from 'react-native';
import { setupLifecycleTracking } from '../instrumentation/lifecycle';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
  },
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('setupLifecycleTracking', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let capturedHandler: ((state: string) => void) | null = null;

  beforeEach(() => {
    capturedHandler = null;
    addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        capturedHandler = handler as (state: string) => void;
        return { remove: jest.fn() };
      });
    jest.clearAllMocks();
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  it('registers AppState listener', () => {
    const teardown = setupLifecycleTracking(baseConfig);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    teardown();
  });

  it('creates span on background transition', () => {
    const teardown = setupLifecycleTracking(baseConfig);
    capturedHandler?.('background');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppLifecycle: background',
      expect.objectContaining({ 'app.state': 'background' }),
      null,
    );
    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 1);
    teardown();
  });

  it('creates span on foreground transition', () => {
    const teardown = setupLifecycleTracking(baseConfig);
    capturedHandler?.('active');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppLifecycle: foreground',
      expect.objectContaining({ 'app.state': 'active' }),
      null,
    );
    teardown();
  });

  it('surfaces SDK errors via console.warn even when debug is false', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (EdotNativeModule.startSpan as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native boom');
    });

    const teardown = setupLifecycleTracking({ ...baseConfig, debug: false });
    capturedHandler?.('background');

    expect(warnSpy).toHaveBeenCalledWith(
      '[EDOT] Lifecycle tracking error:',
      expect.any(Error),
    );

    warnSpy.mockRestore();
    teardown();
  });
});
