## MODIFIED Requirements

### Requirement: Minimal React Native example app
The monorepo SHALL include multiple example apps under `example/` subdirectories. Each app imports SDK packages from the workspace. The `example/basic/` app SHALL initialize the SDK and display the session ID on screen.

#### Scenario: Basic example app builds on iOS
- **WHEN** `pod install` is run in `example/basic/ios/` and the app is built via Xcode
- **THEN** the app launches without errors
- **THEN** the EDOT SDK initializes and a session ID is displayed

#### Scenario: Basic example app builds on Android
- **WHEN** the app is built via `./gradlew assembleDebug` in `example/basic/android/`
- **THEN** the app launches without errors
- **THEN** the EDOT SDK initializes and a session ID is displayed

### Requirement: Example app demonstrates core APIs
The basic example app SHALL call and display results from: `EdotReactNative.initialize()`, `getCurrentSessionId()`, `setUser()`, `setSessionAttribute()`, `setGlobalAttribute()`, plus manual tracing, metrics, and structured logs.

#### Scenario: All core APIs exercised
- **WHEN** the example app is running
- **THEN** the user can trigger each core API via on-screen buttons
- **THEN** debug console shows `[EDOT]` log entries confirming each API call
