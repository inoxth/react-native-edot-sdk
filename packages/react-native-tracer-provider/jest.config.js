module.exports = {
  preset: '@react-native/jest-preset',
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@inox)/)',
  ],
  moduleNameMapper: {
    '^@inox/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts',
    '^@inox/react-native-edot-sdk/active-view-context$': '<rootDir>/../react-native/src/activeViewContext',
    '^@inox/react-native-edot-sdk/nativeModule$': '<rootDir>/../react-native/src/nativeModule',
  },
};
