import { setupErrorHandler, reportError } from '../instrumentation/errors';
import { EdotNativeModule } from '../nativeModule';
import { setActiveView, clearActiveView } from '../context/ActiveViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('err-span-1'),
    endSpan: jest.fn(),
    reportJsException: jest.fn(),
    addSpanLink: jest.fn(),
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
    clearActiveView();
  });

  afterEach(() => {
    clearActiveView();
  });

  it('includes view.name and view.id when active view exists', () => {
    setActiveView({ traceId: 'vt1', spanId: 'vs1' }, 'CheckoutScreen');

    reportError(new TypeError('test error'), 'js_uncaught', true);

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'JS Error',
      expect.objectContaining({
        'view.name': 'CheckoutScreen',
        'view.id': 'vs1',
      }),
      null,
    );
  });

  it('calls addSpanLink when active view exists', () => {
    setActiveView({ traceId: 'vt1', spanId: 'vs1' }, 'CheckoutScreen');

    reportError(new TypeError('test error'), 'js_uncaught', true);

    expect(EdotNativeModule.addSpanLink).toHaveBeenCalledWith('err-span-1', 'vt1', 'vs1');
  });

  it('omits view attributes when no active view', () => {
    reportError(new Error('test error'), 'js_uncaught', false);

    const attrs = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('view.name');
    expect(attrs).not.toHaveProperty('view.id');
    expect(EdotNativeModule.addSpanLink).not.toHaveBeenCalled();
  });
});
