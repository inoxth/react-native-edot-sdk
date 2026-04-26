import { extractHost, sanitizeUrl, shouldIgnore, shouldPropagate } from '../instrumentation/urlUtils';

describe('sanitizeUrl', () => {
  it('strips query parameters', () => {
    expect(sanitizeUrl('https://api.example.com/users?token=secret')).toBe(
      'https://api.example.com/users',
    );
  });

  it('returns url unchanged when no query params', () => {
    expect(sanitizeUrl('https://api.example.com/users')).toBe('https://api.example.com/users');
  });

  it('applies custom sanitizer after default', () => {
    const custom = (url: string) => url.replace(/\/users\/[^/]+/, '/users/{id}');
    expect(sanitizeUrl('https://api.example.com/users/123?token=x', custom)).toBe(
      'https://api.example.com/users/{id}',
    );
  });
});

describe('shouldIgnore', () => {
  const serverUrl = 'https://apm.example.com:8200';

  it('ignores EDOT server URL', () => {
    expect(shouldIgnore('https://apm.example.com:8200/intake', undefined, serverUrl)).toBe(true);
  });

  it('ignores URL matching string pattern', () => {
    expect(shouldIgnore('https://api.example.com/health', ['/health'], serverUrl)).toBe(true);
  });

  it('ignores URL matching regex pattern', () => {
    expect(shouldIgnore('https://api.example.com/health', [/\/health$/], serverUrl)).toBe(true);
  });

  it('does not ignore non-matching URL', () => {
    expect(shouldIgnore('https://api.example.com/users', [/\/health$/], serverUrl)).toBe(false);
  });

  it('does not ignore when no patterns', () => {
    expect(shouldIgnore('https://api.example.com/users', undefined, serverUrl)).toBe(false);
  });
});

describe('extractHost', () => {
  it('returns the host for a standard URL', () => {
    expect(extractHost('https://api.example.com/users')).toBe('api.example.com');
  });

  it('includes port when present', () => {
    expect(extractHost('https://api.example.com:8443/users')).toBe('api.example.com:8443');
  });

  it('returns null for malformed URL', () => {
    expect(extractHost('not a url')).toBeNull();
  });
});

describe('shouldPropagate', () => {
  it('returns false when no targets', () => {
    expect(shouldPropagate('https://api.example.com/users', undefined)).toBe(false);
  });

  it('returns true for matching regex target', () => {
    expect(shouldPropagate('https://api.example.com/users', [/api\.example\.com/])).toBe(true);
  });

  it('returns false for non-matching target', () => {
    expect(shouldPropagate('https://other.example.com/data', [/api\.example\.com/])).toBe(false);
  });
});
