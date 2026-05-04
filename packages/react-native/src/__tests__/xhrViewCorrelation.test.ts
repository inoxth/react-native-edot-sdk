import { setupXhrInstrumentation } from '../instrumentation/xhr';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('xhr-span-1'),
    startClientSpan: jest.fn().mockReturnValue('xhr-span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    setSpanAttributeNumber: jest.fn(),
    setSpanAttributeBoolean: jest.fn(),
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

describe('XHR view correlation', () => {
  let teardown: () => void;

  beforeEach(() => {
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    teardown?.();
    ActiveViewContext._resetForTesting();
  });

  it('includes screen.name and screen.id when active view exists', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'hs1' });
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/feed');
    xhr.send();

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'screen.name': 'HomeScreen',
        'screen.id': 'hs1',
      }),
      null,
      '@inox/react-native-edot-sdk/xhr',
    );
  });

  it('omits view attributes when no active view', () => {
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    const attrs = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('screen.name');
    expect(attrs).not.toHaveProperty('screen.id');
    expect(attrs).not.toHaveProperty('view.name');
    expect(attrs).not.toHaveProperty('view.id');
  });

  it('captures view context at send time', () => {
    ActiveViewContext.setActiveView({ name: 'ScreenA', spanId: 'vs-a' });
    teardown = setupXhrInstrumentation(baseConfig);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/slow');

    ActiveViewContext.setActiveView({ name: 'ScreenB', spanId: 'vs-b' });
    xhr.send();

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'screen.name': 'ScreenB',
        'screen.id': 'vs-b',
      }),
      null,
      '@inox/react-native-edot-sdk/xhr',
    );
  });
});
