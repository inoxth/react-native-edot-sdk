import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { EdotNativeModule } from '../nativeModule';
import { trackSpan, untrackSpan } from '../instrumentation/spanCleanup';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
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

  it('creates span when open + send are called', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send();

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({ 'http.request.method': 'GET' }),
      null,
    );
  });

  it('skips ignored URLs', () => {
    teardown = setupXhrInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/health');
    xhr.send();

    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('skips EDOT server URL', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://apm.example.com:8200/intake');
    xhr.send();

    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('tracks span on send and untracks on load', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    expect(trackSpan).toHaveBeenCalledWith('span-1');

    xhr.dispatch('load');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', expect.any(Number));
    expect(untrackSpan).toHaveBeenCalledWith('span-1');
  });

  it('ends span and untracks on abort', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('POST', 'https://api.example.com/submit');
    xhr.send('body');

    expect(trackSpan).toHaveBeenCalledWith('span-1');

    xhr.dispatch('abort');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 0);
    expect(untrackSpan).toHaveBeenCalledWith('span-1');
  });

  it('idempotent: second event after abort is a no-op', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XHR();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    xhr.dispatch('abort');
    xhr.dispatch('load');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledTimes(1);
    expect(untrackSpan).toHaveBeenCalledTimes(1);
  });
});
