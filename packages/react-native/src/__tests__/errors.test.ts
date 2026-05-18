import { setupErrorHandler } from '../instrumentation/errors';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    reportJsException: jest.fn(),
    recordSpanException: jest.fn(),
    emitLog: jest.fn(),
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
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    delete global.ErrorUtils;
    ActiveViewContext._resetForTesting();
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

    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it('routes fatal errors to reportJsException (crash event path)', () => {
    setupErrorHandler(baseConfig);

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    installedHandler(new TypeError('boom'), true);

    expect(EdotNativeModule.reportJsException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TypeError',
        message: 'boom',
        isFatal: true,
      }),
    );
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
    expect(EdotNativeModule.emitLog).not.toHaveBeenCalled();
  });

  it('routes non-fatal errors with an active view to recordSpanException on the view span', () => {
    ActiveViewContext.setActiveView({ name: 'CheckoutScreen', spanId: 'view-span-9' });
    setupErrorHandler(baseConfig);

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    installedHandler(new TypeError('soft fail'), false);

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith('view-span-9', {
      name: 'TypeError',
      message: 'soft fail',
      stack: expect.any(String),
    });
    expect(EdotNativeModule.reportJsException).not.toHaveBeenCalled();
    expect(EdotNativeModule.emitLog).not.toHaveBeenCalled();
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('routes non-fatal errors without an active view to emitLog as an exception event', () => {
    setupErrorHandler(baseConfig);

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    const err = new TypeError('orphan fail');
    installedHandler(err, false);

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'error',
      'orphan fail',
      expect.objectContaining({
        'event.name': 'exception',
        'exception.type': 'TypeError',
        'exception.message': 'orphan fail',
        'error.source': 'js_uncaught',
      }),
    );
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
    expect(EdotNativeModule.reportJsException).not.toHaveBeenCalled();
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
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
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    delete global.ErrorUtils;
    ActiveViewContext._resetForTesting();
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
        recordSpanException: jest.fn(),
        emitLog: jest.fn(),
      },
    }));

    const { setupErrorHandler: setup } = require('../instrumentation/errors');
    const teardown = setup(baseConfig);
    teardown();

    const { EdotNativeModule: mod } = require('../nativeModule');
    (mod.emitLog as jest.Mock).mockClear();
    (mod.reportJsException as jest.Mock).mockClear();
    (mod.recordSpanException as jest.Mock).mockClear();
    callbacks[0]?.(1, new Error('stale'));
    expect(mod.emitLog).not.toHaveBeenCalled();
    expect(mod.reportJsException).not.toHaveBeenCalled();
    expect(mod.recordSpanException).not.toHaveBeenCalled();

    jest.dontMock('promise/setimmediate/rejection-tracking');
  });
});
