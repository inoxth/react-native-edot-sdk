import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    recordSpanException: jest.fn(),
  },
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
}

describe('setupXhrInstrumentation', () => {
  let teardown: () => void;

  beforeEach(() => {
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
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
      'HTTP GET',
      expect.objectContaining({ 'http.method': 'GET' }),
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
});
