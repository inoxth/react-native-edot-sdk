# AGENTS.md — @inoxth/react-native-edot-cli

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
npx @inoxth/react-native-edot-cli upload-sourcemap \
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

### Per-platform service names

The CLI uploads one bundle/sourcemap pair per invocation under one `--service-name`. When the SDK config splits service identity per platform via `ios.serviceName` / `android.serviceName` (see `packages/react-native/AGENTS.md`), the iOS and Android bundles upload as separate services — invoke `upload-sourcemap` once per platform, passing the matching `--service-name` for that platform's APM service:

```bash
edot upload-sourcemap --service-name myapp-ios     --bundle-path index.ios.bundle     --sourcemap-path index.ios.bundle.map     ...
edot upload-sourcemap --service-name myapp-android --bundle-path index.android.bundle --sourcemap-path index.android.bundle.map ...
```

The CLI itself has no notion of platform — it's the caller's responsibility to align `--service-name` with whichever APM service the bundle reports under at runtime.

## Dependencies

- `commander ^12.0.0`
- devDependencies: `@types/node ^20.0.0`
