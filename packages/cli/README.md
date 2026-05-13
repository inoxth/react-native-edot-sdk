# @inox/react-native-edot-cli

Command-line tool for the React Native EDOT SDK. Currently provides a single command for uploading JS bundles and source maps to your APM server so server-side stack traces can be symbolicated.

## Install

```bash
yarn add --dev @inox/react-native-edot-cli
```

You can also invoke it once-off with `yarn dlx`:

```bash
yarn dlx @inox/react-native-edot-cli upload-sourcemap …
```

## upload-sourcemap

Uploads the JS bundle and its source map for a given service name + version. The service identity must match what your app passes to `EdotReactNative.initialize(...)` so the server can correlate uploaded sources with received error events.

```bash
npx @inox/react-native-edot-cli upload-sourcemap \
  --server-url https://your-apm-server:8200 \
  --service-name my-app \
  --service-version 1.0.0 \
  --bundle-path ios/main.jsbundle \
  --sourcemap-path ios/main.jsbundle.map \
  --secret-token your-token
```

### Options

| Flag                | Required | Description                                           |
| ------------------- | -------- | ----------------------------------------------------- |
| `--server-url`      | yes      | EDOT / APM server URL (matches the SDK's `serverUrl`) |
| `--service-name`    | yes      | Service name (matches the SDK's `serviceName`)        |
| `--service-version` | yes      | Service version (matches the SDK's `serviceVersion`)  |
| `--bundle-path`     | yes      | Path to the minified JS bundle                        |
| `--sourcemap-path`  | yes      | Path to the source map file                           |
| `--secret-token`    | one of   | Secret token authentication                           |
| `--api-key`         | one of   | API key authentication                                |

Provide either `--secret-token` or `--api-key`, not both.

### Typical CI workflow

After producing a release bundle, upload it before shipping the binary:

```bash
react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --sourcemap-output ios/main.jsbundle.map

npx @inox/react-native-edot-cli upload-sourcemap \
  --server-url "$EDOT_SERVER_URL" \
  --service-name my-app \
  --service-version "$APP_VERSION" \
  --bundle-path ios/main.jsbundle \
  --sourcemap-path ios/main.jsbundle.map \
  --secret-token "$EDOT_SECRET_TOKEN"
```

Set authentication tokens via environment variables in CI — never commit them.

## Requirements

- Node.js >= 18

## License

MIT — see [LICENSE](../../LICENSE).
