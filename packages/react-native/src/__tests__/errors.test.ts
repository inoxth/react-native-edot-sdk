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

declare const ErrorUtils: {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

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
    );
    expect(EdotNativeModule.reportJsException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeError', isFatal: true }),
    );
    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it('includes service resource attributes on error spans', () => {
    setupErrorHandler({
      ...baseConfig,
      serviceName: 'my-app',
      serviceVersion: '2.0.0',
      deploymentEnvironment: 'production',
    });

    const installedHandler = (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0];
    installedHandler(new Error('boom'), false);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'JS Error',
      expect.objectContaining({
        'service.name': 'my-app',
        'service.version': '2.0.0',
        'deployment.environment': 'production',
      }),
      null,
    );
  });

  it('restores previous handler on teardown', () => {
    const teardown = setupErrorHandler(baseConfig);
    teardown();

    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(2);
    expect((ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[1][0]).toBe(previousHandler);
  });
});
