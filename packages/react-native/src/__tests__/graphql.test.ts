import { extractGraphqlOperationName, isGraphqlUrl } from '../instrumentation/graphql';

describe('extractGraphqlOperationName', () => {
  it('extracts operationName from JSON body', () => {
    const body = JSON.stringify({
      operationName: 'GetUser',
      query: 'query GetUser { user { id } }',
    });
    expect(extractGraphqlOperationName(body)).toBe('GetUser');
  });

  it('extracts name from query string when operationName missing', () => {
    const body = JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' });
    expect(extractGraphqlOperationName(body)).toBe('CreateUser');
  });

  it('returns null for non-JSON body', () => {
    expect(extractGraphqlOperationName('not json')).toBeNull();
  });

  it('returns null for undefined body', () => {
    expect(extractGraphqlOperationName(undefined)).toBeNull();
  });

  it('returns null when no operation name found', () => {
    const body = JSON.stringify({ data: 'something' });
    expect(extractGraphqlOperationName(body)).toBeNull();
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
