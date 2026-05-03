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
      'GET api.example.com',
      expect.objectContaining({ 'http.method': 'GET' }),
      null,
    );
    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('span-1', 1);
  });

  it('uses legacy HTTP attribute names per Elastic mobile spec', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users?token=abc');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'GET api.example.com',
      expect.objectContaining({
        'http.method': 'GET',
        'http.url': 'https://api.example.com/users',
        'http.scheme': 'https',
        'http.target': '/users',
        'net.peer.name': 'api.example.com',
        'net.peer.port': 443,
      }),
      null,
    );
  });

  it('does NOT emit v1.23 stable HTTP attribute names', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    const [, attrs] = (EdotNativeModule.startSpan as jest.Mock).mock.calls[0];
    expect(attrs).not.toHaveProperty('http.request.method');
    expect(attrs).not.toHaveProperty('url.full');
  });

  it('records request body size as http.request_body.size (legacy underscore form)', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users', { method: 'POST', body: 'hello' });

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.request_body.size',
      5,
    );
  });

  it('records response status code as http.status_code (legacy)', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.status_code',
      200,
    );
  });

  it('records response body size as http.response_body.size (legacy)', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    expect(EdotNativeModule.setSpanAttributeNumber).toHaveBeenCalledWith(
      'span-1',
      'http.response_body.size',
      2,
    );
  });

  it('uses default port 80 for http URLs', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('http://api.example.com/users');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'http.scheme': 'http',
        'net.peer.port': 80,
      }),
      null,
    );
  });

  it('uses explicit port when set in URL', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com:8443/users');

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ 'net.peer.port': 8443 }),
      null,
    );
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
    global.fetch = originalFetch;
    teardown();
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

  it('injects X-Edot-RN-Traced header so native swizzle skips this request', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    const [, init] = (originalFetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('X-Edot-RN-Traced')).toBe('1');
  });

  it('injects dedup header even when caller passes Headers instance', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    const callerHeaders = new Headers({ 'X-Caller': 'me' });
    await global.fetch('https://api.example.com/users', { headers: callerHeaders });

    const [, init] = (originalFetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('X-Edot-RN-Traced')).toBe('1');
    expect(headers.get('X-Caller')).toBe('me');
  });
});
