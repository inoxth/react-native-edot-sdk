module.exports = {
  preset: '@react-native/jest-preset',
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$', '\\.test\\.js$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@testing-library)/)',
  ],
  moduleNameMapper: {
    '^react$': '<rootDir>/../../node_modules/react',
    '^react-test-renderer$': '<rootDir>/../../node_modules/react-test-renderer',
    '^@inox/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts',
    '^@inox/react-native-edot-sdk/nativeModule$': '<rootDir>/src/nativeModule',
  },
};
