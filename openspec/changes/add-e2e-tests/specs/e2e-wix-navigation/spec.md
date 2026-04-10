## ADDED Requirements

### Requirement: Wix Navigation example Detox configuration
The example SHALL have `.detoxrc.js`, `e2e/jest.config.js`, and Detox devDependency.

#### Scenario: iOS Detox build succeeds
- **WHEN** `npx detox build --configuration ios.sim.release` is run in `example/wix-navigation/`
- **THEN** the app builds for the iOS simulator

#### Scenario: Android Detox build succeeds
- **WHEN** `npx detox build --configuration android.emu.release` is run in `example/wix-navigation/`
- **THEN** the app builds for the Android emulator

### Requirement: Wix Navigation E2E covers navigation and demos
The E2E tests SHALL verify tab switching, push navigation, and all demo screen interactions.

#### Scenario: Tab navigation
- **WHEN** the app launches
- **THEN** bottom tabs (Home, Demos, Settings) are visible
- **THEN** tapping each tab switches to that screen

#### Scenario: Demo screen push
- **WHEN** the user taps a demo button on the Demos tab
- **THEN** the app pushes the detail screen via Navigation.push
- **THEN** the user can navigate back

#### Scenario: Demo interactions
- **WHEN** the user interacts with buttons on each demo screen
- **THEN** the app does not crash

### Requirement: testID props on all interactive elements
All screens SHALL have `testID` props on interactive elements following the `{screen}-{element}` convention.

#### Scenario: Elements are findable by testID
- **WHEN** Detox queries elements by testID
- **THEN** all interactive elements are found and tappable
