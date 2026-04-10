## Why

The basic example has a minimal Detox E2E test (8 tests covering title, status, and button taps) but is missing a `.detoxrc.js` config file. The 3 navigation examples have no E2E tests at all and no `testID` props on their UI elements. Without E2E coverage, there's no automated way to verify the example apps work end-to-end on a real simulator.

## What Changes

- Add `.detoxrc.js` to each example app with iOS simulator configuration
- Add `testID` props to all interactive elements in the 3 navigation examples
- Create comprehensive E2E test suites for all 4 examples covering:
  - SDK initialization and session ID display
  - Navigation between tabs and screens (for navigation examples)
  - Demo screen interactions (tracing, metrics, logs, network, errors buttons)
  - User/session/global attribute operations
- Update the basic example's existing E2E tests to cover the new demo sections
- Add Detox as a devDependency to the 3 navigation examples

## Capabilities

### New Capabilities
- `e2e-basic`: E2E test suite for the basic example covering all demo sections
- `e2e-react-navigation`: E2E test suite for the React Navigation example
- `e2e-expo-router`: E2E test suite for the Expo Router example
- `e2e-wix-navigation`: E2E test suite for the Wix Navigation example

### Modified Capabilities

## Impact

- All 4 example apps get `testID` props on interactive elements
- Each example gets `.detoxrc.js`, `e2e/jest.config.js`, and `e2e/app.test.js`
- Navigation examples need `detox` and `jest` added to devDependencies
- CI pipeline can run E2E tests per example with `npx detox test --configuration ios.sim.release`
