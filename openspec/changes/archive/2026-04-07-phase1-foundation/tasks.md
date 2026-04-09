## 1. Monorepo Scaffold

- [x] 1.1 Initialize root `package.json` with Yarn Workspaces config (`packages/*`, `example`)
- [x] 1.2 Create root `tsconfig.json` with `strict: true` and project references
- [x] 1.3 Configure ESLint with `@react-native` preset and Prettier at root
- [x] 1.4 Configure Jest with `react-native` preset at root
- [x] 1.5 Create `packages/react-native/` directory structure: `src/`, `ios/`, `android/`, `src/__tests__/`
- [x] 1.6 Create `packages/react-native/package.json` with bob build config, peer deps (`react`, `react-native`)
- [x] 1.7 Create `packages/react-native/tsconfig.json` extending root
- [x] 1.8 Create `packages/react-native/bob.config.js` for CommonJS + ESM + types output
- [x] 1.9 Verify `yarn install` resolves all workspace dependencies
- [x] 1.10 Verify `yarn lint` and `yarn test` run without errors on empty project

## 2. TurboModule Spec & JS Module Loader

- [x] 2.1 Create `src/NativeEdotReactNative.ts` TurboModule spec with all bridge methods
- [x] 2.2 Create `src/nativeModule.ts` with runtime architecture detection and conditional import
- [x] 2.3 Create Proxy-based no-op fallback module in `src/nativeModule.ts`
- [x] 2.4 Write unit tests for architecture detection and no-op fallback behavior

## 3. EdotConfig & Initialization

- [x] 3.1 Create `src/types.ts` with `EdotConfig` interface and all fields (required + optional)
- [x] 3.2 Create `src/config.ts` with config validation logic (required fields, sampling range, auth exclusivity)
- [x] 3.3 Create `src/defaults.ts` with default config values
- [x] 3.4 Create `src/EdotReactNative.ts` main class with `initialize()`, double-init guard, and config merge
- [x] 3.5 Create `src/index.ts` entry point exporting `EdotReactNative`, `EdotConfig`, and public types
- [x] 3.6 Write unit tests for config validation (missing fields, invalid values, auth conflict)
- [x] 3.7 Write unit tests for default merging and double-init prevention

## 4. Resource Attribute Detection

- [x] 4.1 Create `src/resource.ts` with JS-side detection: `rn.version`, `rn.hermes`, `rn.architecture`
- [x] 4.2 Add architecture detection logic (`global.__turboModuleProxy`, `global.nativeFabricUIManager`)
- [x] 4.3 Add Hermes detection (`global.HermesInternal`)
- [x] 4.4 Add SDK version constant (injected at build time or read from package.json)
- [x] 4.5 Wire resource attributes into `initialize()` to pass to native module
- [x] 4.6 Write unit tests for resource detection with mocked globals

## 5. iOS Native Module

- [x] 5.1 Create `ios/EdotReactNative.podspec` with `React-Core` dependency (ElasticApm v2.0.0 added by consumer via SPM)
- [x] 5.2 Create `ios/EdotReactNative.swift` main module with all bridge methods
- [x] 5.3 Create `ios/EdotReactNativeAgent.swift` with `preInitialize()` static method
- [x] 5.4 Create `ios/EdotReactNative.m` ObjC bridge header for old architecture
- [x] 5.5 Implement `initialize()` — translate JS config to EDOT iOS `AgentConfigBuilder`, start agent
- [x] 5.6 Implement `getCurrentSessionId()`, `setUser()`, `clearUser()`
- [x] 5.7 Implement `setSessionAttribute()`, `setGlobalAttribute()`, `removeGlobalAttribute()`
- [x] 5.8 Implement span registry with `NSLock`-protected dictionary
- [x] 5.9 Implement `startSpan()` (synchronous), `endSpan()`, `setSpanAttribute()`, `recordSpanException()`
- [x] 5.10 Implement `recordMetric()` and `emitLog()` bridge methods
- [x] 5.11 Implement pre-init merge logic (check `isInitialized` flag, merge JS config)

## 6. Android Native Module

- [x] 6.1 Create `android/build.gradle.kts` with `react-android` and EDOT Android SDK dependencies
- [x] 6.2 Create `EdotReactNativeModule.kt` with all `@ReactMethod` bridge methods
- [x] 6.3 Create `EdotReactNativePackage.kt` for module registration
- [x] 6.4 Create `EdotReactNativeAgent.kt` with `preInitialize()` static method
- [x] 6.5 Implement `initialize()` — translate JS config to EDOT Android agent config, start agent
- [x] 6.6 Implement `getCurrentSessionId()`, `setUser()`, `clearUser()`
- [x] 6.7 Implement `setSessionAttribute()`, `setGlobalAttribute()`, `removeGlobalAttribute()`
- [x] 6.8 Implement span registry with `ConcurrentHashMap`
- [x] 6.9 Implement `startSpan()` (synchronous via `isBlockingSynchronousMethod`), `endSpan()`, `setSpanAttribute()`, `recordSpanException()`
- [x] 6.10 Implement `recordMetric()` and `emitLog()` bridge methods
- [x] 6.11 Implement pre-init merge logic (check `isInitialized` flag, merge JS config)

## 7. Example App

- [x] 7.1 Create `example/` React Native app using `npx @react-native-community/cli init`
- [x] 7.2 Add workspace dependency on `@inox/react-native-edot-sdk`
- [x] 7.3 Configure iOS Podfile to include EDOT pod and link workspace package
- [x] 7.4 Configure Android `build.gradle.kts` to include EDOT Gradle plugin
- [x] 7.5 Create main screen with SDK init, session ID display, and buttons for core APIs
- [x] 7.6 Verify example app builds and runs on iOS simulator
- [x] 7.7 Verify example app builds and runs on Android emulator

## 8. Integration Verification

- [x] 8.1 Verify TurboModule codegen produces valid bindings from `NativeEdotReactNative.ts`
- [ ] 8.2 Verify old arch bridge works on RN 0.72 example app build
- [x] 8.3 Verify no-op fallback works when native module is intentionally unlinked
- [x] 8.4 Verify `debug: true` produces `[EDOT]` console output
- [x] 8.5 Run full lint + type-check + unit tests — all green
