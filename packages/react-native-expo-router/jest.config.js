module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@inox-edot|expo-router)/)',
  ],
  moduleNameMapper: {
    '^@inox-edot/react-native/active-view-context$': '<rootDir>/../react-native/src/activeViewContext',
    '^@inox-edot/react-native/nativeModule$': '<rootDir>/../react-native/src/nativeModule',
  },
};
