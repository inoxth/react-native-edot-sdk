## ADDED Requirements

### Requirement: Basic example Detox configuration
The basic example SHALL have a `.detoxrc.js` with both `ios.sim.release` and `android.emu.release` configurations targeting the EdotExample workspace/scheme (iOS) and Gradle project (Android).

#### Scenario: iOS Detox build succeeds
- **WHEN** `npx detox build --configuration ios.sim.release` is run in `example/basic/`
- **THEN** the app builds successfully for the iOS simulator

#### Scenario: Android Detox build succeeds
- **WHEN** `npx detox build --configuration android.emu.release` is run in `example/basic/`
- **THEN** the app builds successfully for the Android emulator

### Requirement: Basic example E2E covers all demo sections
The basic example E2E tests SHALL verify every demo section is visible and interactive.

#### Scenario: SDK initialization
- **WHEN** the app launches
- **THEN** the title, status, and session ID are visible

#### Scenario: Tracing demo
- **WHEN** the user taps "Create Span" and "Nested Spans" buttons
- **THEN** the app does not crash and the log section updates

#### Scenario: Metrics demo
- **WHEN** the user taps Counter, Histogram, and UpDownCounter buttons
- **THEN** the app does not crash and the log section updates

#### Scenario: Logs demo
- **WHEN** the user taps Info, Warn, Error log buttons
- **THEN** the app does not crash

#### Scenario: Network demo
- **WHEN** the user taps Fetch Data, Fetch Error, Fetch Multiple, XHR buttons
- **THEN** the app does not crash and results display

#### Scenario: Error tracing demo
- **WHEN** the user taps error demo buttons (JS Error, Promise Rejection)
- **THEN** the app recovers or shows error boundary fallback

#### Scenario: User interaction demo
- **WHEN** the user taps tracked button and hook action button
- **THEN** the app does not crash
