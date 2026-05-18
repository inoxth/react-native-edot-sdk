import { setupErrorHandler, reportError } from '../instrumentation/errors';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('err-span-1'),
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

describe('error handler view correlation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    ActiveViewContext._resetForTesting();
  });

  it('records the exception as an event on the active view span', () => {
    ActiveViewContext.setActiveView({ name: 'CheckoutScreen', spanId: 'vs1' });

    reportError(new TypeError('test error'), 'js_uncaught', false);

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith('vs1', {
      name: 'TypeError',
      message: 'test error',
      stack: expect.any(String),
    });
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
    expect(EdotNativeModule.emitLog).not.toHaveBeenCalled();
  });

  it('emits an exception log event when there is no active view', () => {
    reportError(new Error('orphan error'), 'js_uncaught', false);

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'error',
      'orphan error',
      expect.objectContaining({
        'event.name': 'exception',
        'exception.type': 'Error',
        'error.source': 'js_uncaught',
      }),
    );
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('routes fatal errors through reportJsException regardless of active view', () => {
    ActiveViewContext.setActiveView({ name: 'CheckoutScreen', spanId: 'vs1' });

    reportError(new Error('fatal'), 'js_uncaught', true);

    expect(EdotNativeModule.reportJsException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Error', message: 'fatal', isFatal: true }),
    );
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
    expect(EdotNativeModule.emitLog).not.toHaveBeenCalled();
  });

  it('sets up global error handler', () => {
    const mockSetGlobal = jest.fn();
    const mockGetGlobal = jest.fn().mockReturnValue(() => {});
    global.ErrorUtils = {
      getGlobalHandler: mockGetGlobal,
      setGlobalHandler: mockSetGlobal,
    };

    const teardown = setupErrorHandler(baseConfig);
    expect(mockSetGlobal).toHaveBeenCalled();

    teardown();
  });
});
