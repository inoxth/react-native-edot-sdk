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
  if (url.startsWith(serverUrl)) {
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

export function shouldPropagate(url: string, targets: (string | RegExp)[] | undefined): boolean {
  if (!targets || targets.length === 0) {
    return false;
  }
  return targets.some((pattern) => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

export function extractMethod(input: RequestInfo, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (typeof input !== 'string' && 'method' in input) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

export function extractUrl(input: RequestInfo): string {
  if (typeof input === 'string') {
    return input;
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
