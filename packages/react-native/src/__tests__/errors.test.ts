import { setupErrorHandler } from '../instrumentation/errors';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    reportJsException: jest.fn(),
  },
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

declare const ErrorUtils: ErrorUtilsLike;

describe('setupErrorHandler', () => {
  let previousHandler: jest.Mock;

  beforeEach(() => {
    previousHandler = jest.fn();
    global.ErrorUtils = {
      getGlobalHandler: jest.fn(() => previousHandler),
      setGlobalHandler: jest.fn(),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.ErrorUtils;
  });

  it('installs global error handler', () => {
    setupErrorHandler(baseConfig);
    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('chains with existing handler on error', () => {
    setupErrorHandler(baseConfig);

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    const error = new TypeError('test error');
    installedHandler(error, true);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'JS Error',
      expect.objectContaining({
        'exception.type': 'TypeError',
        'error.source': 'js_uncaught',
      }),
      null,
      '@inox/react-native-edot-sdk/errors',
    );
    expect(EdotNativeModule.reportJsException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeError', isFatal: true }),
    );
    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it('does not stamp service identity on error spans (Resource carries it)', () => {
    setupErrorHandler({
      ...baseConfig,
      serviceName: 'my-app',
      serviceVersion: '2.0.0',
      deploymentEnvironment: 'production',
    });

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    installedHandler(new Error('boom'), false);

    const [, attrs] = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0];
    expect(attrs).not.toHaveProperty('service.name');
    expect(attrs).not.toHaveProperty('service.version');
    expect(attrs).not.toHaveProperty('deployment.environment');
  });

  it('restores previous handler on teardown', () => {
    const teardown = setupErrorHandler(baseConfig);
    teardown();

    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(2);
    expect((ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[1][0]).toBe(previousHandler);
  });

  // F-24: ErrorUtils absent
  it('skips global handler setup and warns when ErrorUtils is absent', () => {
    delete global.ErrorUtils;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const teardown = setupErrorHandler(baseConfig);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ErrorUtils is not available'));
    expect(() => teardown()).not.toThrow();

    warnSpy.mockRestore();
  });

  // F-24: ErrorUtils present but missing methods
  it('skips global handler setup when ErrorUtils methods are missing', () => {
    global.ErrorUtils = {} as ErrorUtilsLike;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const teardown = setupErrorHandler(baseConfig);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ErrorUtils is not available'));
    expect(() => teardown()).not.toThrow();

    warnSpy.mockRestore();
  });
});

describe('setupErrorHandler — promise rejection tracker', () => {
  let previousHandler: jest.Mock;

  beforeEach(() => {
    previousHandler = jest.fn();
    global.ErrorUtils = {
      getGlobalHandler: jest.fn(() => previousHandler),
      setGlobalHandler: jest.fn(),
    };
    // Ensure no Hermes tracker so we exercise the require() path
    delete (global as Record<string, unknown>).HermesInternal;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.ErrorUtils;
    jest.resetModules();
  });

  // F-22: rejection-tracking has unexpected shape
  it('warns and returns no-op teardown when rejection-tracking has wrong shape', () => {
    jest.doMock('promise/setimmediate/rejection-tracking', () => ({ notEnable: true }));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { setupErrorHandler: setup } = require('../instrumentation/errors');
    const teardown = setup(baseConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('rejection-tracking module has unexpected shape'),
    );
    expect(() => teardown()).not.toThrow();

    warnSpy.mockRestore();
    jest.dontMock('promise/setimmediate/rejection-tracking');
  });

  // F-19: teardown calls disable() when available
  it('calls tracking.disable() on teardown when available', () => {
    const disableMock = jest.fn();
    jest.doMock('promise/setimmediate/rejection-tracking', () => ({
      enable: jest.fn(),
      disable: disableMock,
    }));

    const { setupErrorHandler: setup } = require('../instrumentation/errors');
    const teardown = setup(baseConfig);
    teardown();

    expect(disableMock).toHaveBeenCalled();

    jest.dontMock('promise/setimmediate/rejection-tracking');
  });

  // F-19: teardown with no disable() — must not throw
  it('teardown does not throw when tracking.disable is absent', () => {
    jest.doMock('promise/setimmediate/rejection-tracking', () => ({
      enable: jest.fn(),
    }));

    const { setupErrorHandler: setup } = require('../instrumentation/errors');
    const teardown = setup(baseConfig);
    expect(() => teardown()).not.toThrow();

    jest.dontMock('promise/setimmediate/rejection-tracking');
  });

  // F-19: stale closure does not fire after teardown
  it('suppresses onUnhandled callbacks after teardown', () => {
    const callbacks: Array<(id: number, r: unknown) => void> = [];
    jest.doMock('promise/setimmediate/rejection-tracking', () => ({
      enable: jest.fn((opts: { onUnhandled: (id: number, r: unknown) => void }) => {
        callbacks.push(opts.onUnhandled);
      }),
    }));

    jest.mock('../nativeModule', () => ({
      EdotNativeModule: {
        startSpan: jest.fn().mockReturnValue('span-x'),
        endSpan: jest.fn(),
        reportJsException: jest.fn(),
      },
    }));

    const { setupErrorHandler: setup } = require('../instrumentation/errors');
    const teardown = setup(baseConfig);
    teardown();

    const { EdotNativeModule: mod } = require('../nativeModule');
    (mod.startSpan as jest.Mock).mockClear();
    callbacks[0]?.(1, new Error('stale'));
    expect(mod.startSpan).not.toHaveBeenCalled();

    jest.dontMock('promise/setimmediate/rejection-tracking');
  });
});
