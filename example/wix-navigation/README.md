# EDOT Wix Navigation Example

Example React Native app using [Wix react-native-navigation](https://github.com/wix/react-native-navigation) with the React Native EDOT SDK.

## Setup

1. Copy `.env.example` to `.env` and fill in your APM server details:

```bash
cp .env.example .env
```

2. Install dependencies from the monorepo root:

```bash
cd ../..
yarn install
```

3. Run the app:

```bash
# iOS
yarn ios

# Android
yarn android
```

## Features

- **Home** -- SDK status, session ID, user/session/global attributes
- **Demos** -- Network requests, manual tracing, metrics, structured logs, error tracking
- **Settings** -- Display current `.env` configuration

## Wix Navigation Integration

This example uses `registerEdotNavigationListener` from `@inox/react-native-edot-navigation` to automatically track screen transitions as spans. A `screenNameMapper` maps component names to human-readable screen names.
