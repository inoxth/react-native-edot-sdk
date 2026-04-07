module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@inox-edot|expo-router)/)',
  ],
  moduleNameMapper: {
    '^@inox-edot/core$': '<rootDir>/../core/src/index.ts',
    '^@inox-edot/react-native/nativeModule$': '<rootDir>/../react-native/src/nativeModule',
  },
};
