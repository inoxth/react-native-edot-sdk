# Example App Specification

## Purpose
Provide a working React Native example app within the monorepo that demonstrates SDK integration and core API usage.

## Requirements

### Requirement: Minimal React Native example app
The monorepo SHALL include an `example/` directory containing a React Native app that imports `@inox/react-native-edot-sdk` from the workspace. The app SHALL initialize the SDK and display the session ID on screen.

#### Scenario: Example app builds on iOS
- **WHEN** `pod install` is run in `example/ios/` and the app is built via Xcode
- **THEN** the app launches without errors
- **THEN** the EDOT SDK initializes and a session ID is displayed

#### Scenario: Example app builds on Android
- **WHEN** the app is built via `./gradlew assembleDebug` in `example/android/`
- **THEN** the app launches without errors
- **THEN** the EDOT SDK initializes and a session ID is displayed

### Requirement: Example app demonstrates core APIs
The example app SHALL call and display results from: `EdotReactNative.initialize()`, `getCurrentSessionId()`, `setUser()`, `setSessionAttribute()`, and `setGlobalAttribute()`.

#### Scenario: All core APIs exercised
- **WHEN** the example app is running
- **THEN** the user can trigger each core API via on-screen buttons
- **THEN** debug console shows `[EDOT]` log entries confirming each API call
