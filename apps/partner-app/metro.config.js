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

// Own transform cache: expo-router's hoisted _ctx files share a path across both Expo apps,
// so a shared cache can serve the outlet app's routes here.
config.cacheStores = [new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') })];

module.exports = withNativeWind(config, { input: './global.css' });
