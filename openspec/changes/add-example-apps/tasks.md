## 1. Restructure existing example

- [x] 1.1 Move `example/` contents to `example/basic/` (git mv)
- [x] 1.2 Update root `package.json` workspaces from `"example"` to `"example/*"`
- [x] 1.3 Update root `tsconfig.json` exclude for new example paths
- [x] 1.4 Update `example/basic/metro.config.js` paths for new directory depth
- [x] 1.5 Update `example/basic/tsconfig.json` paths for new directory depth
- [x] 1.6 Verify `yarn install` resolves workspaces correctly

## 2. Enhance basic example

- [x] 2.1 Add `.env.example` with `EDOT_SERVER_URL`, `EDOT_SERVICE_NAME`, `EDOT_SERVICE_VERSION`, `EDOT_SECRET_TOKEN`, `EDOT_DEPLOYMENT_ENVIRONMENT`
- [x] 2.2 Add manual tracing demo section (custom spans, nested spans with `withSpanContext`)
- [x] 2.3 Add metrics demo section (Counter, Histogram, UpDownCounter)
- [x] 2.4 Add structured logs demo (info, warn, error severity buttons)
- [x] 2.5 Add network request demo (fetch success, fetch error, fetch multiple, XHR request — all auto-instrumented)
- [x] 2.6 Add error tracing demo (throw JS error, reject Promise, ErrorBoundary render error, trigger native crash)
- [x] 2.7 Add user interaction demo (`withEdotTracking` HOC, `useEdotAction` hook)
- [x] 2.8 Add `@inox/react-native-edot-tracer-provider` dependency to `example/basic/package.json`

## 3. React Navigation example

- [x] 3.1 Create `example/react-navigation/` scaffold (package.json, metro.config.js, tsconfig.json, babel.config.js, index.js)
- [x] 3.2 Add dependencies: `@inox/react-native-edot-sdk`, `@inox/react-native-edot-navigation`, `@inox/react-native-edot-tracer-provider`, `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`
- [x] 3.3 Add `.env.example` and `.env` gitignore entry
- [x] 3.4 Create App.tsx with `NavigationContainer` + `createEdotNavigationContainerRef` + bottom tabs (Home, Demos, Settings) with nested stack navigators
- [x] 3.5 Create HomeScreen with SDK status, session ID, user/session/global attribute buttons
- [x] 3.6 Create DemosScreen tab with navigation to NetworkDemo, TracingDemo, MetricsDemo, LogsDemo, ErrorDemo detail screens
- [x] 3.7 Create NetworkDemo screen (fetch success, fetch error, fetch multiple, XHR request — auto-instrumented spans)
- [x] 3.8 Create TracingDemo screen (custom spans, nested spans with `withSpanContext`)
- [x] 3.9 Create MetricsDemo screen (Counter, Histogram, UpDownCounter)
- [x] 3.10 Create LogsDemo screen (info, warn, error log buttons)
- [x] 3.11 Create ErrorDemo screen (throw JS error, reject Promise, ErrorBoundary render error, trigger native crash)
- [x] 3.12 Create SettingsScreen with .env config display
- [x] 3.13 Add README.md with setup instructions

## 4. Expo Router example

- [x] 4.1 Create `example/expo-router/` scaffold (package.json, metro.config.js, tsconfig.json, babel.config.js, index.js)
- [x] 4.2 Add dependencies: `@inox/react-native-edot-sdk`, `@inox/react-native-edot-expo-router`, `@inox/react-native-edot-tracer-provider`, `expo-router`, `expo`
- [x] 4.3 Add `.env.example` and `.env` gitignore entry
- [x] 4.4 Create `app/_layout.tsx` with `<EdotExpoNavigationProvider>` and `screenNameMapper`
- [x] 4.5 Create `app/(tabs)/_layout.tsx` with bottom tab layout (Home, Demos, Settings)
- [x] 4.6 Create `app/(tabs)/index.tsx` (Home) with SDK status, session, user/session/global attribute buttons
- [x] 4.7 Create `app/(tabs)/demos.tsx` with links to `app/demos/network.tsx`, `app/demos/tracing.tsx`, `app/demos/metrics.tsx`, `app/demos/logs.tsx`, `app/demos/errors.tsx`
- [x] 4.8 Create `app/demos/network.tsx` (fetch success, fetch error, fetch multiple — auto-instrumented spans)
- [x] 4.9 Create `app/demos/tracing.tsx` (custom spans, nested spans)
- [x] 4.10 Create `app/demos/metrics.tsx` (Counter, Histogram, UpDownCounter)
- [x] 4.11 Create `app/demos/logs.tsx` (log severity buttons)
- [x] 4.12 Create `app/demos/errors.tsx` (throw JS error, reject Promise, ErrorBoundary render error, trigger native crash)
- [x] 4.13 Create `app/(tabs)/settings.tsx` with .env config display
- [x] 4.14 Add README.md with setup instructions

## 5. Wix react-native-navigation example

- [x] 5.1 Create `example/wix-navigation/` scaffold (package.json, metro.config.js, tsconfig.json, babel.config.js, index.js)
- [x] 5.2 Add dependencies: `@inox/react-native-edot-sdk`, `@inox/react-native-edot-wix-navigation`, `@inox/react-native-edot-tracer-provider`, `react-native-navigation`
- [x] 5.3 Add `.env.example` and `.env` gitignore entry
- [x] 5.4 Create index.js with `Navigation.registerComponent` for all screens + `registerEdotNavigationListener` + `Navigation.setRoot` with bottomTabs (Home, Demos, Settings) each containing a stack
- [x] 5.5 Create HomeScreen with SDK status, session, user/session/global attribute buttons
- [x] 5.6 Create DemosScreen with buttons that `Navigation.push` to NetworkDemo, TracingDemo, MetricsDemo, LogsDemo, ErrorDemo
- [x] 5.7 Create NetworkDemo screen (fetch success, fetch error, fetch multiple, XHR request — auto-instrumented spans)
- [x] 5.8 Create TracingDemo screen (custom spans, nested spans)
- [x] 5.9 Create MetricsDemo screen (Counter, Histogram, UpDownCounter)
- [x] 5.10 Create LogsDemo screen (log severity buttons)
- [x] 5.11 Create ErrorDemo screen (throw JS error, reject Promise, ErrorBoundary render error, trigger native crash)
- [x] 5.12 Create SettingsScreen with .env config display
- [x] 5.13 Add README.md with setup instructions

## 6. Documentation and verification

- [x] 6.1 Update root README.md examples section to reference all 4 example apps
- [x] 6.2 Update AGENTS.md example app section for new multi-example structure
- [x] 6.3 Add `.env` to root `.gitignore` for all example dirs
- [x] 6.4 Verify `yarn install` + `yarn typecheck` pass
- [x] 6.5 Verify basic example builds on iOS simulator
