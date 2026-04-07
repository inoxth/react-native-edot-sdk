import { InteractionManager } from 'react-native';
import { setupStartupTracing } from '../instrumentation/startup';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
  },
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('setupStartupTracing', () => {
  let runAfterSpy: jest.SpyInstance;
  let capturedCallback: (() => void) | null = null;

  beforeEach(() => {
    capturedCallback = null;
    runAfterSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((callback) => {
        if (typeof callback === 'function') {
          capturedCallback = callback;
        }
        return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() };
      });
    jest.clearAllMocks();
  });

  afterEach(() => {
    runAfterSpy.mockRestore();
  });

  it('creates parent AppStartup span', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppStartup: cold',
      expect.objectContaining({ 'app.startup.type': 'cold' }),
      null,
    );
    teardown();
  });

  it('creates child spans for js_bundle_load and first_render', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledTimes(3);
    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppStartup: js_bundle_load',
      {},
      'span-1',
    );
    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppStartup: first_render',
      {},
      'span-1',
    );
    teardown();
  });

  it('ends js_bundle_load span immediately', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 1);
    teardown();
  });

  it('ends first_render and parent span after interactions', () => {
    jest.clearAllMocks();
    const teardown = setupStartupTracing(baseConfig);

    const endCallsBefore = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;

    capturedCallback?.();

    const endCallsAfter = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;
    expect(endCallsAfter).toBeGreaterThan(endCallsBefore);
    teardown();
  });

  it('registers InteractionManager callback', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
    teardown();
  });
});
