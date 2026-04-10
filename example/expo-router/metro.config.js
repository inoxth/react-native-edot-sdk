const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '../..');

const packages = path.resolve(root, 'packages');

const subpathMap = {
  '@inox/react-native-edot-sdk/nativeModule': path.resolve(packages, 'react-native/src/nativeModule.ts'),
  '@inox/react-native-edot-sdk/active-view-context': path.resolve(packages, 'react-native/src/activeViewContext.ts'),
};

const config = getDefaultConfig(__dirname);

config.watchFolders = [root];

config.resolver.extraNodeModules = {
  '@inox/react-native-edot-sdk': path.resolve(root, 'packages/react-native'),
  '@inox/react-native-edot-expo-router': path.resolve(root, 'packages/react-native-expo-router'),
  '@inox/react-native-edot-tracer-provider': path.resolve(root, 'packages/react-native-tracer-provider'),
};

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(root, 'node_modules'),
];

config.resolver.resolveRequest = function (context, moduleName, platform) {
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
};

module.exports = config;
