const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');

const packages = path.resolve(root, 'packages');

const subpathMap = {
  '@inox/react-native-edot-sdk/nativeModule': path.resolve(packages, 'react-native/src/nativeModule.ts'),
  '@inox/react-native-edot-sdk/active-view-context': path.resolve(packages, 'react-native/src/activeViewContext.ts'),
};

const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@inox/react-native-edot-sdk': path.resolve(root, 'packages/react-native'),
      '@inox/react-native-edot-navigation': path.resolve(root, 'packages/react-native-navigation'),
      '@inox/react-native-edot-tracer-provider': path.resolve(root, 'packages/react-native-tracer-provider'),
    },
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(root, 'node_modules'),
    ],
    resolveRequest(context, moduleName, platform) {
      if (subpathMap[moduleName]) {
        return { filePath: subpathMap[moduleName], type: 'sourceFile' };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
