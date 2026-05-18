import {
  buildGraphqlSpanName,
  extractGraphqlOperation,
  isGraphqlUrl,
} from '../instrumentation/graphql';

describe('extractGraphqlOperation', () => {
  it('extracts type and name from operationName plus query', () => {
    const body = JSON.stringify({
      operationName: 'GetUser',
      query: 'query GetUser { user { id } }',
    });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'query', name: 'GetUser' });
  });

  it('extracts mutation type from query when operationName missing', () => {
    const body = JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'mutation', name: 'CreateUser' });
  });

  it('extracts subscription type from query', () => {
    const body = JSON.stringify({ query: 'subscription OnTick { tick }' });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'subscription', name: 'OnTick' });
  });

  it('uses operationName as the name when query has no keyword (shorthand)', () => {
    const body = JSON.stringify({
      operationName: 'GetUser',
      query: '{ user { id } }',
    });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'query', name: 'GetUser' });
  });

  it('defaults to query type for anonymous shorthand documents', () => {
    const body = JSON.stringify({ query: '{ user { id } }' });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'query' });
  });

  it('returns anonymous query when keyword present without a name', () => {
    const body = JSON.stringify({ query: 'query { user { id } }' });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'query' });
  });

  it('prefers operationName over the name parsed from query', () => {
    const body = JSON.stringify({
      operationName: 'Primary',
      query: 'query Secondary { user { id } } query Primary { user { id } }',
    });
    expect(extractGraphqlOperation(body)).toEqual({ type: 'query', name: 'Primary' });
  });

  it('returns null for non-JSON body', () => {
    expect(extractGraphqlOperation('not json')).toBeNull();
  });

  it('returns null for undefined body', () => {
    expect(extractGraphqlOperation(undefined)).toBeNull();
  });

  it('returns null when JSON has no query or operationName', () => {
    expect(extractGraphqlOperation(JSON.stringify({ data: 'something' }))).toBeNull();
  });
});

describe('buildGraphqlSpanName', () => {
  it('formats named operations as "<type> <name>"', () => {
    expect(buildGraphqlSpanName({ type: 'query', name: 'GetUser' })).toBe('query GetUser');
    expect(buildGraphqlSpanName({ type: 'mutation', name: 'CreateUser' })).toBe(
      'mutation CreateUser',
    );
    expect(buildGraphqlSpanName({ type: 'subscription', name: 'OnTick' })).toBe(
      'subscription OnTick',
    );
  });

  it('falls back to the bare operation type for anonymous operations', () => {
    expect(buildGraphqlSpanName({ type: 'query' })).toBe('query');
  });
});

describe('isGraphqlUrl', () => {
  it('returns true for matching regex', () => {
    expect(isGraphqlUrl('https://api.example.com/graphql', [/\/graphql$/])).toBe(true);
  });

  it('returns false for non-matching URL', () => {
    expect(isGraphqlUrl('https://api.example.com/users', [/\/graphql$/])).toBe(false);
  });

  it('returns false when no graphqlUrls configured', () => {
    expect(isGraphqlUrl('https://api.example.com/graphql', undefined)).toBe(false);
  });
});
