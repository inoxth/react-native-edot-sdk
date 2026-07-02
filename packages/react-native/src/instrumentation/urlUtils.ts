import type { EdotConfig } from '../types';

export function sanitizeUrl(url: string, customSanitizer?: EdotConfig['urlSanitizer']): string {
  let sanitized = url;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    sanitized = parsed.toString();
  } catch {
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      sanitized = url.substring(0, queryIndex);
    }
  }
  if (customSanitizer) {
    sanitized = customSanitizer(sanitized);
  }
  return sanitized;
}

export function shouldIgnore(
  url: string,
  ignoreUrls: (string | RegExp)[] | undefined,
  serverUrl: string,
): boolean {
  if (sameOrigin(url, serverUrl)) {
    return true;
  }
  if (!ignoreUrls) {
    return false;
  }
  return ignoreUrls.some((pattern) => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

/**
 * Whether two URLs share the same origin (scheme + host + effective port).
 * Used to exclude requests to the EDOT server from tracing. Compared by origin
 * rather than a raw `startsWith(serverUrl)` prefix, which (a) over-matched
 * lookalike hosts — `https://apm.example.com.evil.test` starts with
 * `https://apm.example.com`, silently dropping unrelated requests — and (b)
 * missed the server when the port normalized differently (explicit `:443` vs
 * none). Reuses the existing extractors so scheme-default ports resolve
 * consistently (`extractPort` returns 443/80 by scheme). (DEV-782)
 */
function sameOrigin(a: string, b: string): boolean {
  const scheme = extractScheme(a);
  const host = extractHostname(a);
  const port = extractPort(a);
  if (scheme === null || host === null || port === null) {
    return false;
  }
  return scheme === extractScheme(b) && host === extractHostname(b) && port === extractPort(b);
}

export function shouldPropagate(url: string, targets: (string | RegExp)[] | undefined): boolean {
  if (targets === undefined) {
    return true;
  }
  if (targets.length === 0) {
    return false;
  }
  return targets.some((pattern) => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

export function extractMethod(input: URL | RequestInfo, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (typeof input !== 'string' && !(input instanceof URL) && 'method' in input) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

export function extractUrl(input: URL | RequestInfo): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

export function extractHost(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export function extractPort(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      const value = Number(parsed.port);
      return Number.isFinite(value) ? value : null;
    }
    if (parsed.protocol === 'http:') return 80;
    if (parsed.protocol === 'https:') return 443;
    return null;
  } catch {
    return null;
  }
}

export function extractScheme(url: string): string | null {
  try {
    const protocol = new URL(url).protocol;
    return protocol ? protocol.replace(/:$/, '') : null;
  } catch {
    return null;
  }
}

export function extractTarget(url: string): string | null {
  try {
    const parsed = new URL(url);
    const target = `${parsed.pathname}${parsed.search}`;
    return target || null;
  } catch {
    return null;
  }
}

/**
 * Ensures serverUrl carries an explicit port. apm-agent-ios falls back to its
 * hardcoded :8200 default for a portless URL (Foundation's URL.port is nil when
 * no port is written in the string), while Android and standard URL semantics
 * resolve to the scheme default — so the same portless serverUrl silently
 * targets different ports per platform. Appends the scheme default (443 for
 * https, 80 for http) when no port is present. Idempotent: a URL that already
 * specifies a port (default or not) is returned unchanged. (DEV-783)
 */
export function ensureExplicitPort(serverUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    return serverUrl;
  }
  const defaultPort =
    parsed.protocol === 'https:' ? '443' : parsed.protocol === 'http:' ? '80' : null;
  if (defaultPort === null) {
    return serverUrl;
  }
  const schemeEnd = serverUrl.indexOf('://') + 3;
  const authority = serverUrl.slice(schemeEnd).split(/[/?#]/)[0];
  const hostPort = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;
  if (/:\d+$/.test(hostPort)) {
    return serverUrl;
  }
  const insertAt = schemeEnd + authority.length;
  return `${serverUrl.slice(0, insertAt)}:${defaultPort}${serverUrl.slice(insertAt)}`;
}
