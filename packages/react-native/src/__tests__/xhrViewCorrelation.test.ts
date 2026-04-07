import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { EdotNativeModule } from '../nativeModule';
import { setActiveView, clearActiveView } from '../context/ActiveViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('xhr-span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    recordSpanException: jest.fn(),
    addSpanLink: jest.fn(),
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

describe('XHR view correlation', () => {
  let teardown: () => void;

  beforeEach(() => {
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    jest.clearAllMocks();
    clearActiveView();
  });

  afterEach(() => {
    teardown?.();
    clearActiveView();
  });

  it('includes view.name and view.id when active view exists', () => {
    setActiveView({ traceId: 'ht1', spanId: 'hs1' }, 'HomeScreen');
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/feed');
    xhr.send();

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({
        'view.name': 'HomeScreen',
        'view.id': 'hs1',
      }),
      null,
    );
  });

  it('calls addSpanLink when active view exists', () => {
    setActiveView({ traceId: 'ht1', spanId: 'hs1' }, 'HomeScreen');
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/feed');
    xhr.send();

    expect(EdotNativeModule.addSpanLink).toHaveBeenCalledWith('xhr-span-1', 'ht1', 'hs1');
  });

  it('omits view attributes when no active view', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    const attrs = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('view.name');
    expect(attrs).not.toHaveProperty('view.id');
    expect(EdotNativeModule.addSpanLink).not.toHaveBeenCalled();
  });

  it('captures view context at send time', () => {
    setActiveView({ traceId: 'vt-a', spanId: 'vs-a' }, 'ScreenA');
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/slow');

    setActiveView({ traceId: 'vt-b', spanId: 'vs-b' }, 'ScreenB');
    xhr.send();

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({
        'view.name': 'ScreenB',
        'view.id': 'vs-b',
      }),
      null,
    );
  });
});
