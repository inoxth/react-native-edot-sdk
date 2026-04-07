export function extractGraphqlOperationName(body: string | undefined): string | null {
  if (!body) {
    return null;
  }
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.operationName === 'string' && parsed.operationName.length > 0) {
      return parsed.operationName;
    }
    if (typeof parsed.query === 'string') {
      const match = parsed.query.match(/(?:query|mutation|subscription)\s+(\w+)/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // Not valid JSON — skip
  }
  return null;
}

export function isGraphqlUrl(url: string, graphqlUrls: (string | RegExp)[] | undefined): boolean {
  if (!graphqlUrls || graphqlUrls.length === 0) {
    return false;
  }
  return graphqlUrls.some((pattern) => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}
