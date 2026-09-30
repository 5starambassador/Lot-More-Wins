const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const { FileStore } = require('metro-cache');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Own transform cache. Both Expo apps transform the same hoisted files (e.g. expo-router's
// route context, which inlines the app root); with the default shared cache the outlet app
// could be served the partner app's routes.
config.cacheStores = [new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') })];

module.exports = withNativeWind(config, { input: './global.css' });
