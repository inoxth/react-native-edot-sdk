import { setupFetchInstrumentation } from '../instrumentation/fetch';
import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { reportError } from '../instrumentation/errors';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    startClientSpan: jest.fn().mockReturnValue('span-1'),
    getTraceparent: jest.fn().mockReturnValue(''),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    setSpanAttributeNumber: jest.fn(),
    setSpanAttributeBoolean: jest.fn(),
    recordSpanException: jest.fn(),
    reportJsException: jest.fn(),
    emitLog: jest.fn(),
  },
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('view correlation on fetch', () => {
  let teardown: () => void;

  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, headers: { 'content-length': '2' } }));
    ActiveViewContext._resetForTesting();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardown?.();
  });

  it('attaches screen attributes when active view exists', async () => {
    ActiveViewContext.setActiveView({ name: 'ProductDetail', spanId: 'view-span-123' });
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/products/42');

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'screen.name': 'ProductDetail',
        'screen.id': 'view-span-123',
      }),
      null,
      '@inoxth/react-native-edot-sdk/http',
    );
  });

  it('omits screen attributes when no active view', async () => {
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/products/42');

    const attrs = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0][1];
    expect(attrs['screen.name']).toBeUndefined();
    expect(attrs['screen.id']).toBeUndefined();
    expect(attrs['view.name']).toBeUndefined();
    expect(attrs['view.id']).toBeUndefined();
  });
});

class MockXMLHttpRequest {
  static DONE = 4;
  status = 0;
  readyState = 0;
  responseText = '';
  private _listeners: Record<string, Array<() => void>> = {};

  open(_method: string, _url: string): void {}
  send(_body?: string | null): void {}
  setRequestHeader(_key: string, _value: string): void {}
  getResponseHeader(_name: string): string | null {
    return null;
  }
  addEventListener(event: string, handler: () => void): void {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }
}

describe('view correlation on XHR', () => {
  let teardown: () => void;

  beforeEach(() => {
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    ActiveViewContext._resetForTesting();
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardown?.();
  });

  it('attaches screen attributes when active view exists', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'view-span-456' });
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'screen.name': 'HomeScreen',
        'screen.id': 'view-span-456',
      }),
      null,
      '@inoxth/react-native-edot-sdk/http',
    );
  });

  it('omits screen attributes when no active view', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    const attrs = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0][1];
    expect(attrs['screen.name']).toBeUndefined();
    expect(attrs['screen.id']).toBeUndefined();
    expect(attrs['view.name']).toBeUndefined();
    expect(attrs['view.id']).toBeUndefined();
  });
});

describe('view correlation on errors', () => {
  beforeEach(() => {
    ActiveViewContext._resetForTesting();
    jest.clearAllMocks();
  });

  it('records the exception as an event on the active view span', () => {
    ActiveViewContext.setActiveView({ name: 'CheckoutScreen', spanId: 'view-span-789' });

    reportError(new Error('test error'), 'js_uncaught', false);

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith('view-span-789', {
      name: 'Error',
      message: 'test error',
      stack: expect.any(String),
    });
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
    expect(EdotNativeModule.emitLog).not.toHaveBeenCalled();
  });

  it('emits an exception log without screen attributes when no active view', () => {
    reportError(new Error('test error'), 'js_uncaught', false);

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'error',
      'test error',
      expect.objectContaining({ 'event.name': 'exception', 'exception.type': 'Error' }),
    );
    const [, , attrs] = (EdotNativeModule.emitLog as jest.Mock).mock.calls[0];
    expect(attrs['screen.name']).toBeUndefined();
    expect(attrs['screen.id']).toBeUndefined();
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
  });
});
