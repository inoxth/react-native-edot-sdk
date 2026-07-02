import {
  ensureExplicitPort,
  extractHost,
  extractHostname,
  extractPort,
  extractScheme,
  extractTarget,
  sanitizeUrl,
  shouldIgnore,
  shouldPropagate,
} from '../instrumentation/urlUtils';

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
  it('returns true when targets is undefined (default propagates to all)', () => {
    expect(shouldPropagate('https://api.example.com/users', undefined)).toBe(true);
  });

  it('returns false when targets is an empty array (explicit opt-out)', () => {
    expect(shouldPropagate('https://api.example.com/users', [])).toBe(false);
  });

  it('returns true for matching regex target', () => {
    expect(shouldPropagate('https://api.example.com/users', [/api\.example\.com/])).toBe(true);
  });

  it('returns false for non-matching target', () => {
    expect(shouldPropagate('https://other.example.com/data', [/api\.example\.com/])).toBe(false);
  });

  it('returns true for matching string target', () => {
    expect(shouldPropagate('https://api.example.com/users', ['api.example.com'])).toBe(true);
  });
});

describe('shouldIgnore vs propagate-all default', () => {
  const serverUrl = 'https://apm.example.com:8200';

  it('shouldIgnore still wins for the EDOT server URL even when propagate-all is the default', () => {
    const url = 'https://apm.example.com:8200/intake';
    expect(shouldIgnore(url, undefined, serverUrl)).toBe(true);
    expect(shouldPropagate(url, undefined)).toBe(true);
  });

  it('shouldIgnore still wins for ignoreUrls matches even when propagate-all is the default', () => {
    const url = 'https://api.example.com/health';
    expect(shouldIgnore(url, [/\/health$/], serverUrl)).toBe(true);
    expect(shouldPropagate(url, undefined)).toBe(true);
  });
});

describe('extractHostname', () => {
  it('returns hostname without port', () => {
    expect(extractHostname('https://api.example.com:8443/users')).toBe('api.example.com');
  });

  it('returns hostname for plain URL', () => {
    expect(extractHostname('https://api.example.com/users')).toBe('api.example.com');
  });

  it('returns null for malformed URL', () => {
    expect(extractHostname('not a url')).toBeNull();
  });
});

describe('extractPort', () => {
  it('returns explicit port when set', () => {
    expect(extractPort('https://api.example.com:8443/x')).toBe(8443);
  });

  it('returns 443 for https URLs without explicit port', () => {
    expect(extractPort('https://api.example.com/users')).toBe(443);
  });

  it('returns 80 for http URLs without explicit port', () => {
    expect(extractPort('http://api.example.com/users')).toBe(80);
  });

  it('returns null for unknown scheme without explicit port', () => {
    expect(extractPort('ftp://example.com/file')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(extractPort('not a url')).toBeNull();
  });
});

describe('extractScheme', () => {
  it('returns https for https URLs (no trailing colon)', () => {
    expect(extractScheme('https://api.example.com/users')).toBe('https');
  });

  it('returns http for http URLs', () => {
    expect(extractScheme('http://api.example.com/users')).toBe('http');
  });

  it('returns null for malformed URL', () => {
    expect(extractScheme('not a url')).toBeNull();
  });
});

describe('extractTarget', () => {
  it('returns path + query', () => {
    expect(extractTarget('https://api.example.com/users?id=1')).toBe('/users?id=1');
  });

  it('returns path alone when no query', () => {
    expect(extractTarget('https://api.example.com/users')).toBe('/users');
  });

  it('returns "/" for root path', () => {
    expect(extractTarget('https://api.example.com')).toBe('/');
  });

  it('returns null for malformed URL', () => {
    expect(extractTarget('not a url')).toBeNull();
  });
});

describe('ensureExplicitPort', () => {
  it('appends 443 to a portless https URL', () => {
    expect(ensureExplicitPort('https://apm.example.com')).toBe('https://apm.example.com:443');
  });

  it('appends 80 to a portless http URL', () => {
    expect(ensureExplicitPort('http://apm.example.com')).toBe('http://apm.example.com:80');
  });

  it('leaves an explicit default port unchanged', () => {
    expect(ensureExplicitPort('https://apm.example.com:443')).toBe('https://apm.example.com:443');
  });

  it('leaves an explicit non-default port unchanged', () => {
    expect(ensureExplicitPort('https://apm.example.com:8200')).toBe('https://apm.example.com:8200');
    expect(ensureExplicitPort('https://apm.example.com:1234')).toBe('https://apm.example.com:1234');
  });

  it('preserves path and query while inserting the port', () => {
    expect(ensureExplicitPort('https://apm.example.com/otlp')).toBe(
      'https://apm.example.com:443/otlp',
    );
    expect(ensureExplicitPort('https://apm.example.com/v1?x=1')).toBe(
      'https://apm.example.com:443/v1?x=1',
    );
  });

  it('returns malformed URLs unchanged', () => {
    expect(ensureExplicitPort('not a url')).toBe('not a url');
  });
});
