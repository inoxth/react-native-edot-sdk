## ADDED Requirements

### Requirement: Fetch wrapper accepts URL inputs
The patched `global.fetch` wrapper SHALL accept any input type that the spec form of `fetch(input, init?)` accepts — including `string`, `Request`, and `URL`. When a `URL` instance is provided, the wrapper SHALL convert it to its string form for downstream URL extraction (`extractUrl`), span attribute population, and forwarding to the original `fetch`.

#### Scenario: URL-typed input is accepted and traced
- **GIVEN** the SDK is initialized with `instrumentNetworkRequests: true`
- **WHEN** `fetch(new URL('https://api.example.com/users'))` is called
- **THEN** a span is created with `http.url` set to `https://api.example.com/users`
- **AND** the request is forwarded to the original `fetch` with the URL serialized to string form

#### Scenario: Wrapper signature matches modern fetch
- **WHEN** TypeScript checks `global.fetch = ...` under a tsconfig that types `fetch` with `URL | RequestInfo` first parameter (e.g., `expo/tsconfig.base`)
- **THEN** the assignment SHALL type-check (the wrapper's first parameter is `URL | RequestInfo`)
