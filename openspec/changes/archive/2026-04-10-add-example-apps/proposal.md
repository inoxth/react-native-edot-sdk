## Why

The SDK currently has a single example app that only demonstrates core APIs (initialize, session, user, attributes). There are no examples showing navigation integration, manual tracing, or metrics — making it hard for developers to see how to integrate the full SDK in their apps.

## What Changes

- Add 4 separate example apps under the `example/` directory, each demonstrating a different integration pattern:
  - `example/basic/` — SDK initialization, manual tracing (`getTracerProvider`), metrics (`getMeterProvider`), structured logs, error boundary, user interactions — no navigation
  - `example/react-navigation/` — React Navigation integration with `createEdotNavigationContainerRef`, plus all basic features
  - `example/expo-router/` — Expo Router integration with `EdotExpoNavigationProvider`, plus all basic features
  - `example/wix-navigation/` — Wix react-native-navigation integration with `registerEdotNavigationListener`, plus all basic features
- All examples use `.env` files for configuration (server URL, service name, secret token, etc.)
- Each example is a standalone React Native app with its own `package.json`, Metro config, and native projects
- Rename existing `example/` to `example/basic/` as the starting point

## Capabilities

### New Capabilities
- `example-basic`: Basic integration example with manual tracing, metrics, logs, and user interactions (no navigation)
- `example-react-navigation`: React Navigation integration example
- `example-expo-router`: Expo Router integration example
- `example-wix-navigation`: Wix react-native-navigation integration example

### Modified Capabilities
- `example-app`: Update to reflect the new multi-example structure under `example/`

## Impact

- Root `package.json` workspaces config needs to include `example/*` instead of `example`
- Root `tsconfig.json` exclude needs updating for new example paths
- Existing CI/Detox config may need updating for the new example directory structure
- Each new example adds native iOS/Android projects that need dependencies installed
