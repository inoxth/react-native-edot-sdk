import { setupFetchInstrumentation } from '../instrumentation/fetch';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('net-span-1'),
    startClientSpan: jest.fn().mockReturnValue('net-span-1'),
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

describe('fetch view correlation', () => {
  let originalFetch: typeof global.fetch;
  let teardown: () => void;

  beforeEach(() => {
    originalFetch = jest.fn().mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'content-length': '2' } }),
    );
    global.fetch = originalFetch;
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  afterEach(() => {
    teardown?.();
    ActiveViewContext._resetForTesting();
  });

  it('includes view.name and view.id when active view exists', async () => {
    ActiveViewContext.setActiveView({ name: 'ProductDetailScreen', spanId: 'vs1' });
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/products/1');

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'view.name': 'ProductDetailScreen',
        'view.id': 'vs1',
      }),
      null,
    );
  });

  it('omits view attributes when no active view', async () => {
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/data');

    const attrs = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0][1];
    expect(attrs).not.toHaveProperty('view.name');
    expect(attrs).not.toHaveProperty('view.id');
  });

  it('captures view context at request start, not completion', async () => {
    ActiveViewContext.setActiveView({ name: 'ScreenA', spanId: 'vs-a' });

    let resolveResponse: (value: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    global.fetch = jest.fn().mockReturnValue(pendingResponse);
    teardown = setupFetchInstrumentation(baseConfig);

    const fetchPromise = global.fetch('https://api.example.com/slow');

    ActiveViewContext.setActiveView({ name: 'ScreenB', spanId: 'vs-b' });

    resolveResponse!(new Response('ok', { status: 200 }));
    await fetchPromise;

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'view.name': 'ScreenA',
        'view.id': 'vs-a',
      }),
      null,
    );
  });
});
