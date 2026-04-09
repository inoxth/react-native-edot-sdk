import { setupErrorHandler, reportError } from '../instrumentation/errors';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('err-span-1'),
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

describe('error handler view correlation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    ActiveViewContext._resetForTesting();
  });

  it('includes view.name when active view exists', () => {
    ActiveViewContext.setActiveView({ name: 'CheckoutScreen', spanId: 'vs1' });

    reportError(new TypeError('test error'), 'js_uncaught', true);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'JS Error',
      expect.objectContaining({
        'view.name': 'CheckoutScreen',
      }),
      null,
    );
  });

  it('omits view.name when no active view', () => {
    reportError(new Error('test error'), 'js_uncaught', false);

    const attrs = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('view.name');
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
