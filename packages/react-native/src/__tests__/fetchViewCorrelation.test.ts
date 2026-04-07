import { setupFetchInstrumentation } from '../instrumentation/fetch';
import { EdotNativeModule } from '../nativeModule';
import { setActiveView, clearActiveView } from '../context/ActiveViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('net-span-1'),
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

describe('fetch view correlation', () => {
  let originalFetch: typeof global.fetch;
  let teardown: () => void;

  beforeEach(() => {
    originalFetch = jest.fn().mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'content-length': '2' } }),
    );
    global.fetch = originalFetch;
    jest.clearAllMocks();
    clearActiveView();
  });

  afterEach(() => {
    teardown?.();
    clearActiveView();
  });

  it('includes view.name and view.id when active view exists', async () => {
    setActiveView({ traceId: 'vt1', spanId: 'vs1' }, 'ProductDetailScreen');
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/products/1');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({
        'view.name': 'ProductDetailScreen',
        'view.id': 'vs1',
      }),
      null,
    );
  });

  it('calls addSpanLink when active view exists', async () => {
    setActiveView({ traceId: 'vt1', spanId: 'vs1' }, 'ProductDetailScreen');
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/products/1');

    expect(EdotNativeModule.addSpanLink).toHaveBeenCalledWith('net-span-1', 'vt1', 'vs1');
  });

  it('omits view attributes when no active view', async () => {
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/data');

    const attrs = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('view.name');
    expect(attrs).not.toHaveProperty('view.id');
    expect(EdotNativeModule.addSpanLink).not.toHaveBeenCalled();
  });

  it('captures view context at request start, not completion', async () => {
    setActiveView({ traceId: 'vt-a', spanId: 'vs-a' }, 'ScreenA');

    let resolveResponse: (value: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    global.fetch = jest.fn().mockReturnValue(pendingResponse);
    teardown = setupFetchInstrumentation(baseConfig);

    const fetchPromise = global.fetch('https://api.example.com/slow');

    setActiveView({ traceId: 'vt-b', spanId: 'vs-b' }, 'ScreenB');

    resolveResponse!(new Response('ok', { status: 200 }));
    await fetchPromise;

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({
        'view.name': 'ScreenA',
        'view.id': 'vs-a',
      }),
      null,
    );
    expect(EdotNativeModule.addSpanLink).toHaveBeenCalledWith('net-span-1', 'vt-a', 'vs-a');
  });
});
