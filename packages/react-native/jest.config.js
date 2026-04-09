module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community)/)',
  ],
  moduleNameMapper: {
    '^@inox/react-native-edot-shared$': '<rootDir>/../shared/src/index.ts',
  },
};
