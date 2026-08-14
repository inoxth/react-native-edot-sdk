import { setupFetchInstrumentation } from '../instrumentation/fetch';
import { EdotNativeModule } from '../nativeModule';
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
    originalFetch = jest
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200, headers: { 'content-length': '2' } }));
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    teardown?.();
  });

  it('mints a Request Transaction and hangs the request span under it', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

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

  it('never gives the Request Transaction attributes that re-trigger the iOS agent rescue', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    const [, transactionAttrs] = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[0];
    expect(transactionAttrs).toEqual({});
  });

  it('ends the request span before the Request Transaction, both statuses unset', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('says a failed HTTP status with an exception event, not a span status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('nope', { status: 500, statusText: 'Internal Server Error' }),
      );
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/users');

    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledTimes(1);
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith('span-1', {
      name: '500',
      message: 'Internal Server Error',
      stack: '',
    });
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('records no exception event below 400', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 304 }));
    teardown = setupFetchInstrumentation(baseConfig);

    await global.fetch('https://api.example.com/users');

    expect(EdotNativeModule.recordSpanException).not.toHaveBeenCalled();
  });

  it('uses legacy HTTP attribute names per Elastic mobile spec', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users?token=abc');

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

  it('does NOT emit v1.23 stable HTTP attribute names', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com/users');

    const [, attrs] = (EdotNativeModule.startClientSpan as jest.Mock).mock.calls[1];
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

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'http.scheme': 'http',
        'net.peer.port': 80,
      }),
      'transaction-1',
      '@inoxth/react-native-edot-sdk/http',
    );
  });

  it('uses explicit port when set in URL', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://api.example.com:8443/users');

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ 'net.peer.port': 8443 }),
      'transaction-1',
      '@inoxth/react-native-edot-sdk/http',
    );
  });

  it('skips EDOT server URL', async () => {
    teardown = setupFetchInstrumentation(baseConfig);
    await global.fetch('https://apm.example.com:8200/intake');

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
    expect(originalFetch).toHaveBeenCalled();
  });

  it('skips ignored URLs', async () => {
    teardown = setupFetchInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });
    await global.fetch('https://api.example.com/health');

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
  });

  it('mints no Request Transaction for untraced requests', async () => {
    teardown = setupFetchInstrumentation({ ...baseConfig, ignoreUrls: [/\/health$/] });
    await global.fetch('https://api.example.com/health');
    await global.fetch('https://apm.example.com:8200/intake');

    expect(EdotNativeModule.startClientSpan).not.toHaveBeenCalled();
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
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledWith(
      'span-1',
      expect.objectContaining({ message: 'Network error' }),
    );
    expect(EdotNativeModule.recordSpanException).toHaveBeenCalledTimes(1);
    expect((EdotNativeModule.endSpan as jest.Mock).mock.calls).toEqual([
      ['span-1', -1],
      ['transaction-1', -1],
    ]);
  });

  it('names GraphQL spans per OTel semconv and sets graphql.operation.* attributes', async () => {
    teardown = setupFetchInstrumentation({
      ...baseConfig,
      graphqlUrls: [/\/graphql$/],
    });

    await global.fetch('https://api.example.com/graphql', {
      method: 'POST',
      body: JSON.stringify({ operationName: 'GetUser', query: 'query GetUser { user { id } }' }),
    });

    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'query GetUser',
      expect.objectContaining({
        'graphql.operation.type': 'query',
        'graphql.operation.name': 'GetUser',
      }),
      'transaction-1',
      '@inoxth/react-native-edot-sdk/http',
    );
    expect(EdotNativeModule.startClientSpan).toHaveBeenCalledWith(
      'query GetUser',
      {},
      null,
      '@inoxth/react-native-edot-sdk/http',
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
