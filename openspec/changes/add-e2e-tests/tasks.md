## 1. Basic example E2E

- [x] 1.1 Create `.detoxrc.js` in `example/basic/` with `ios.sim.release` (workspace: EdotExample) and `android.emu.release` (Gradle assembleRelease) configs
- [x] 1.2 Add `testID` props to new demo sections in `example/basic/src/App.tsx` (tracing, metrics, logs, network, errors, interactions buttons)
- [x] 1.3 Update `example/basic/e2e/app.test.js` with tests for all demo sections (tracing, metrics, logs, network, error tracing, user interactions)
- [ ] 1.4 Verify `npx detox build --configuration ios.sim.release` succeeds
- [ ] 1.5 Verify `npx detox test --configuration ios.sim.release` passes

## 2. React Navigation example E2E

- [x] 2.1 Add `detox`, `jest`, `@types/jest` to `example/react-navigation/` devDependencies
- [x] 2.2 Create `.detoxrc.js` with `ios.sim.release` (workspace: EdotReactNavExample) and `android.emu.release` configs
- [x] 2.3 Create `e2e/jest.config.js` with Detox runner config
- [x] 2.4 Add `testID` props to all screens: HomeScreen, DemosScreen, SettingsScreen, NetworkDemo, TracingDemo, MetricsDemo, LogsDemo, ErrorDemo
- [x] 2.5 Create `e2e/app.test.js` with test suites: tab navigation, demo screen push/back, Home screen interactions, each demo screen button taps

## 3. Expo Router example E2E

- [x] 3.1 Add `detox`, `jest`, `@types/jest` to `example/expo-router/` devDependencies
- [x] 3.2 Create `.detoxrc.js` with `ios.sim.release` (workspace: EdotExpoRouterExample) and `android.emu.release` configs
- [x] 3.3 Create `e2e/jest.config.js` with Detox runner config
- [x] 3.4 Add `testID` props to all routes: index, demos, settings, demos/network, demos/tracing, demos/metrics, demos/logs, demos/errors
- [x] 3.5 Create `e2e/app.test.js` with test suites: tab navigation, demo route navigation, Home interactions, each demo screen button taps

## 4. Wix Navigation example E2E

- [x] 4.1 Add `detox`, `jest`, `@types/jest` to `example/wix-navigation/` devDependencies
- [x] 4.2 Create `.detoxrc.js` with `ios.sim.release` (workspace: EdotWixNavExample) and `android.emu.release` configs
- [x] 4.3 Create `e2e/jest.config.js` with Detox runner config
- [x] 4.4 Add `testID` props to all screens: HomeScreen, DemosScreen, SettingsScreen, NetworkDemo, TracingDemo, MetricsDemo, LogsDemo, ErrorDemo
- [x] 4.5 Create `e2e/app.test.js` with test suites: tab navigation, demo screen push/back, Home interactions, each demo screen button taps
