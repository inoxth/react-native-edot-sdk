const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');

const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@inox/react-native-edot-sdk': path.resolve(root, 'packages/react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
