import { setupStartupTracing } from '../instrumentation/startup';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    setSpanAttributeNumber: jest.fn(),
    setSpanAttributeBoolean: jest.fn(),
  },
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('setupStartupTracing', () => {
  let capturedCallback: (() => void) | null = null;
  let requestSpy: jest.Mock;
  let cancelSpy: jest.Mock;

  beforeEach(() => {
    capturedCallback = null;
    requestSpy = jest.fn((callback: () => void) => {
      capturedCallback = callback;
      return 1;
    });
    cancelSpy = jest.fn();
    global.requestIdleCallback = requestSpy;
    global.cancelIdleCallback = cancelSpy;
    jest.clearAllMocks();
  });

  afterEach(() => {
    Reflect.deleteProperty(global, 'requestIdleCallback');
    Reflect.deleteProperty(global, 'cancelIdleCallback');
  });

  it('creates parent AppStartup span', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppStartup: cold',
      expect.objectContaining({ 'app.startup.type': 'cold' }),
      null,
      '@inox/react-native-edot-sdk/startup',
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
      '@inox/react-native-edot-sdk/startup',
    );
    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'AppStartup: first_render',
      {},
      'span-1',
      '@inox/react-native-edot-sdk/startup',
    );
    teardown();
  });

  it('ends js_bundle_load span immediately', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 1);
    teardown();
  });

  it('ends first_render and parent span after idle callback fires', () => {
    jest.clearAllMocks();
    const teardown = setupStartupTracing(baseConfig);

    const endCallsBefore = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;

    capturedCallback?.();

    const endCallsAfter = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;
    expect(endCallsAfter).toBeGreaterThan(endCallsBefore);
    teardown();
  });

  it('registers requestIdleCallback', () => {
    const teardown = setupStartupTracing(baseConfig);

    expect(requestSpy).toHaveBeenCalled();
    teardown();
  });

  it('cancels idle callback on teardown', () => {
    const teardown = setupStartupTracing(baseConfig);
    teardown();
    expect(cancelSpy).toHaveBeenCalledWith(1);
  });
});

// F-23: setTimeout fallback when requestIdleCallback is absent
describe('setupStartupTracing — setTimeout fallback', () => {
  let capturedCallback: (() => void) | null = null;
  let setTimeoutSpy: jest.SpyInstance;
  let clearTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    capturedCallback = null;
    Reflect.deleteProperty(global, 'requestIdleCallback');
    Reflect.deleteProperty(global, 'cancelIdleCallback');

    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      capturedCallback = cb as () => void;
      return 42 as unknown as ReturnType<typeof setTimeout>;
    });
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    setupStartupTracing(baseConfig);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it('cancels via clearTimeout on teardown', () => {
    const teardown = setupStartupTracing(baseConfig);
    teardown();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(42);
  });

  it('fires callback via setTimeout', () => {
    jest.clearAllMocks();
    const teardown = setupStartupTracing(baseConfig);

    const endCallsBefore = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;
    capturedCallback?.();
    const endCallsAfter = (EdotNativeModule.endSpan as jest.Mock).mock.calls.length;
    expect(endCallsAfter).toBeGreaterThan(endCallsBefore);
    teardown();
  });
});
