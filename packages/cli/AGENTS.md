# AGENTS.md — @inox/react-native-edot-cli

## Overview

CLI tool for source map upload. `edot upload-sourcemap` POSTs a JS bundle and source map to the EDOT server for server-side crash symbolication.

## Structure

```
src/
├── index.ts               # CLI entry point (Commander.js)
├── upload-sourcemap.ts    # Multipart upload implementation
└── __tests__/
    └── upload-sourcemap.test.ts
```

## Key API

```bash
npx @inox/react-native-edot-cli upload-sourcemap \
  --server-url <url> \
  --service-name <name> \
  --service-version <version> \
  --bundle-path <path> \
  --sourcemap-path <path> \
  [--secret-token <token>] \
  [--api-key <key>]
```

## Key Patterns

- Uses native Node.js `https` module for uploads (no external HTTP client)
- Builds multipart form data manually via `buildMultipartBody()`
- Built with plain `tsc` (not react-native-builder-bob)
- Test environment: `node` (not react-native preset)

## Dependencies

- `commander ^12.0.0`
- devDependencies: `@types/node ^20.0.0`
