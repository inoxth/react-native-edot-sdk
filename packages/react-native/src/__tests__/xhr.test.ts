import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { EdotNativeModule } from '../nativeModule';
import { trackSpan, untrackSpan } from '../instrumentation/spanCleanup';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('internal-1'),
    // The Request Transaction is the attribute-free call; the request span carries attributes.
    startClientSpan: jest.fn((_name: string, attributes: Record<string, string | number>) =>
      Object.keys(attributes).length === 0 ? 'transaction-1' : 'span-1',
    ),
    getTraceparent: jest
      .fn()
      .mockReturnValue('00-0123456789abcdef0123456789abcdef-fedcba9876543210-01'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    setSpanAttributeNumber: jest.fn(),
    setSpanAttributeBoolean: jest.fn(),
    recordSpanException: jest.fn(),
  },
}));

jest.mock('../instrumentation/spanCleanup', () => ({
  trackSpan: jest.fn(),
  untrackSpan: jest.fn(),
}));

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

class MockXMLHttpRequest {
  static DONE = 4;
  status = 0;
  statusText = '';
  readyState = 0;
  responseText = '';
  private _listeners: Record<string, Array<() => void>> = {};
  private _responseHeaders: Record<string, string> = {};

  open(_method: string, _url: string): void {}
  send(_body?: string | null): void {}
  setRequestHeader(_key: string, _value: string): void {}
  getResponseHeader(name: string): string | null {
    return this._responseHeaders[name.toLowerCase()] ?? null;
  }
  setMockResponseHeader(name: string, value: string): void {
    this._responseHeaders[name.toLowerCase()] = value;
  }
  addEventListener(event: string, handler: () => void): void {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }
  dispatch(event: string): void {
    this._listeners[event]?.forEach((h) => h());
  }
}

describe('setupXhrInstrumentation', () => {
  let teardown: () => void;

  let XHR: new () => MockXMLHttpRequest;

  beforeEach(() => {
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    XHR = MockXMLHttpRequest;
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardown?.();
  });

  it('patches XMLHttpRequest prototype', () => {
    const openBefore = MockXMLHttpRequest.prototype.open;
    teardown = setupXhrInstrumentation(baseConfig);
    expect(XMLHttpRequest.prototype.open).not.toBe(openBefore);
  });

  it('restores original prototype on teardown', () => {
    const openBefore = MockXMLHttpRequest.prototype.open;
    teardown = setupXhrInstrumentation(baseConfig);
    teardown();
    expect(XMLHttpRequest.prototype.open).toBe(openBefore);
  });

  it('mints a Request Transaction and hangs the request span under it', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send();

    // Both are CLIENT spans, as the parent apm-agent-ios manufactures takes its child's kind.
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
    expect((EdotNativeModule.startClientSpan as jest.Mock).mock.calls).toEqual([
      ['GET api.example.com', {}, null, '@inoxth/react-native-edot-sdk/http'],
      [
        'GET api.example.com',
        expect.objectContaining({ 'http.method': 'GET' }),
        'transaction-1',
        '@inoxth/react-native-edot-sdk/http',
      ],
    ]);
  });

  it('never gives the Request Transaction attributes that re-trigger the iOS agent rescue', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send();

    const [, transactionAttrs] = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0];
    expect(transactionAttrs).toEqual({});
  });

  it('ends the request span before the Request Transaction, both statuses unset', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.status = 200;
    xhr.dispatch('load');

    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
  });

  it('says a failed HTTP status with an exception event, not a span status', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.status = 503;
    xhr.statusText = 'Service Unavailable';
    xhr.dispatch('load');

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledTimes(1);
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith('span-1', {
      name: '503',
      message: 'Service Unavailable',
      stack: '',
    });
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('records the exception on the request span only, and sets no status', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.dispatch('error');

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledTimes(1);
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith(
      'span-1',
      expect.objectContaining({ name: 'NetworkError' }),
    );
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('records a timeout as an exception event, told apart by its type', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.dispatch('timeout');

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith(
      'span-1',
      expect.objectContaining({ name: 'TimeoutError' }),
    );
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('records a cancellation as an exception event, told apart by its type', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.dispatch('abort');

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith(
      'span-1',
      expect.objectContaining({ name: 'AbortError' }),
    );
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('uses legacy HTTP attribute names per Elastic mobile spec', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/users?token=abc');
    xhr.send();

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
        'http.scheme': 'https',
        'http.target': '/users',
        'net.peer.name': 'api.example.com',
        'net.peer.port': 443,
      }),
      'transaction-1',
      '@inoxth/react-native-edot-sdk/http',
    );
  });

  it('does NOT emit v1.23 stable HTTP attribute names', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send();

    const attrs = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[1][1];
    expect(attrs).not.toHaveProperty('http.request.method');
    expect(attrs).not.toHaveProperty('url.full');
  });

  it('records request body size as http.request_body.size', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.example.com/submit');
    xhr.send('hello');

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.request_body.size',
      5,
    );
  });

  it('records status code as http.status_code on load', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.status = 200;
    xhr.dispatch('load');

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.status_code',
      200,
    );
  });

  it('records response body size as http.response_body.size on load', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();
    xhr.setMockResponseHeader('content-length', '42');
    xhr.dispatch('load');

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.response_body.size',
      42,
    );
  });

  it('skips ignored URLs', () => {
    teardown = setupXhrInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/health');
    xhr.send();

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
  });

  it('skips EDOT server URL', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://apm.example.com:8200/intake');
    xhr.send();

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
  });

  it('mints no Request Transaction for untraced requests', () => {
    teardown = setupXhrInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });

    const ignored = new XMLHttpRequest();
    ignored.open('GET', 'https://api.example.com/health');
    ignored.send();

    const selfTraffic = new XMLHttpRequest();
    selfTraffic.open('POST', 'https://apm.example.com:8200/intake');
    selfTraffic.send();

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('tracks span on send and untracks on load', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    expect(trackSpan).toHaveBeenCalledWith('span-1');
    expect(trackSpan).toHaveBeenCalledWith('transaction-1');

    xhr.dispatch('load');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', expect.any(Number));
    expect(untrackSpan).toHaveBeenCalledWith('span-1');
    expect(untrackSpan).toHaveBeenCalledWith('transaction-1');
  });

  it('ends span and untracks on abort', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('POST', 'https://api.example.com/submit');
    xhr.send('body');

    expect(trackSpan).toHaveBeenCalledWith('span-1');

    xhr.dispatch('abort');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', -1);
    expect(untrackSpan).toHaveBeenCalledWith('span-1');
  });

  it('idempotent: second event after abort is a no-op', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    xhr.dispatch('abort');
    xhr.dispatch('load');

    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
    expect(untrackSpan).toHaveBeenCalledTimes(2);
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledTimes(1);
  });

  it('injects X-Edot-RN-Traced header so native swizzle skips this request', () => {
    const headerSpy = jest.spyOn(MockXMLHttpRequest.prototype, 'setRequestHeader');
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send();

    expect(headerSpy).toHaveBeenCalledWith('X-Edot-RN-Traced', '1');
    headerSpy.mockRestore();
  });
});
