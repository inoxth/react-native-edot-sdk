import { setupFetchInstrumentation } from '../instrumentation/fetch';
import { EdotNativeModule } from '../nativeModule';
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

const baseConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('setupFetchInstrumentation', () => {
  let originalFetch: typeof global.fetch;
  let teardown: () => void;

  beforeEach(() => {
    originalFetch = jest.fn().mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'content-length': '2' } }),
    );
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardown?.();
  });

  it('creates span for fetch request', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.objectContaining({ 'http.method': 'GET' }),
      null,
    );
    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 1);
  });

  it('skips EDOT server URL', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://apm.example.com:8200/intake');

    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
    expect(originalFetch).toHaveBeenCalled();
  });

  it('skips ignored URLs', async () => {
    teardown = setupFetchInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });
    await global.fetch('https://api.example.com/health');

    expect(EdotNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('records error span on network failure', async () => {
    global.fetch = originalFetch;
    teardown = setupFetchInstrumentation(baseConfig);

    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = originalFetch; // Reset before setup patches
    teardown(); // teardown previous
    global.fetch = mockFetch;
    teardown = setupFetchInstrumentation(baseConfig);

    await expect(global.fetch('https://api.example.com/fail')).rejects.toThrow('Network error');
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalled();
    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 2);
  });

  it('extracts GraphQL operation name', async () => {
    teardown = setupFetchInstrumentation({
      ...baseConfig,
      graphqlUrls: [/\/graphql$/],
    });

    await global.fetch('https://api.example.com/graphql', {
      method: 'POST',
      body: JSON.stringify({ operationName: 'GetUser', query: 'query GetUser { user { id } }' }),
    });

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'GraphQL: GetUser',
      expect.anything(),
      null,
    );
  });

  it('restores original fetch on teardown', () => {
    teardown = setupFetchInstrumentation(baseConfig);
    expect(global.fetch).not.toBe(originalFetch);

    teardown();
    expect(global.fetch).toBe(originalFetch);
  });
});
