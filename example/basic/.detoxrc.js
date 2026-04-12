/** @type {import('detox').DetoxConfig} */
module.exports = {
  logger: {
    level: process.env.CI ? 'debug' : 'info',
  },
  testRunner: {
    $0: 'jest',
    args: {
      config: 'e2e/jest.config.js',
      _: ['e2e'],
    },
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      screenshot: 'failing',
      video: 'failing',
      log: 'all',
    },
  },
  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/EdotExample.app',
      build: "xcodebuild -workspace ios/EdotExample.xcworkspace -scheme EdotExample -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.4' -derivedDataPath ios/build",
    },
    'ios.sim.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/EdotExample.app',
      build: "xcodebuild -workspace ios/EdotExample.xcworkspace -scheme EdotExample -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.4' -derivedDataPath ios/build",
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build: 'cd android && ./gradlew assembleDebug assembleDebugAndroidTest && cd ..',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 17 Pro' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_XL_API_32' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.sim.debug' },
    'ios.sim.release': { device: 'simulator', app: 'ios.sim.release' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
  },
};
