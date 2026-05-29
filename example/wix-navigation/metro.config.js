const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');

const packages = path.resolve(root, 'packages');

const subpathMap = {
  '@inoxth/react-native-edot-sdk/nativeModule': path.resolve(packages, 'react-native/src/nativeModule.ts'),
  '@inoxth/react-native-edot-sdk/active-view-context': path.resolve(packages, 'react-native/src/activeViewContext.ts'),
};

const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@inoxth/react-native-edot-sdk': path.resolve(root, 'packages/react-native'),
      '@inoxth/react-native-edot-navigation': path.resolve(root, 'packages/react-native-navigation'),
      '@inoxth/react-native-edot-tracer-provider': path.resolve(root, 'packages/react-native-tracer-provider'),
    },
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(root, 'node_modules'),
    ],
    resolveRequest(context, moduleName, platform) {
      if (subpathMap[moduleName]) {
        return { filePath: subpathMap[moduleName], type: 'sourceFile' };
      }
      // Force React singletons to resolve from the app's node_modules.
      // Prevents dual-React instance crashes when SDK packages have their own node_modules/react.
      if (moduleName === 'react' || moduleName === 'react-native' || moduleName.startsWith('react/') || moduleName.startsWith('react-native/')) {
        return context.resolveRequest(
          { ...context, originModulePath: __filename },
          moduleName,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
