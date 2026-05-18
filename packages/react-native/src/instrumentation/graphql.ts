export type GraphqlOperationType = 'query' | 'mutation' | 'subscription';

export interface GraphqlOperation {
  type: GraphqlOperationType;
  name?: string;
}

const OPERATION_KEYWORD_RE = /\b(query|mutation|subscription)\b(?:\s+(\w+))?/;

export function extractGraphqlOperation(body: string | undefined): GraphqlOperation | null {
  if (!body) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const query = typeof record.query === 'string' ? record.query : undefined;
  const explicitName =
    typeof record.operationName === 'string' && record.operationName.length > 0
      ? record.operationName
      : undefined;

  let type: GraphqlOperationType = 'query';
  let nameFromQuery: string | undefined;
  if (query) {
    const match = query.match(OPERATION_KEYWORD_RE);
    if (match) {
      type = match[1] as GraphqlOperationType;
      nameFromQuery = match[2];
    }
  }

  if (!query && !explicitName) {
    return null;
  }

  const name = explicitName ?? nameFromQuery;
  return name ? { type, name } : { type };
}

export function buildGraphqlSpanName(op: GraphqlOperation): string {
  return op.name ? `${op.type} ${op.name}` : op.type;
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
