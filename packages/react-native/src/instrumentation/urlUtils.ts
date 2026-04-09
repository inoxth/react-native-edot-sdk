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

export function shouldPropagate(
  url: string,
  targets: (string | RegExp)[] | undefined,
): boolean {
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
