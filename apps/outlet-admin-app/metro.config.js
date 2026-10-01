const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
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

// pnpm links workspace packages (@lotmorewins/*) as junctions to their absolute C:\ path.
// When the repo is opened through a mapped drive (`subst L:`, used to stay under Windows'
// path-length limit for release builds) Metro cannot follow a link across drives, so resolve
// those packages from the monorepo's own packages/ folder. Metro only consults this when
// normal node_modules resolution fails, so the usual C:\ setup is unaffected.
const packagesDir = path.join(monorepoRoot, 'packages');
config.resolver.extraNodeModules = Object.fromEntries(
  fs
    .readdirSync(packagesDir)
    .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
    .map((dir) => [require(path.join(packagesDir, dir, 'package.json')).name, path.join(packagesDir, dir)]),
);

// Own transform cache. Both Expo apps transform the same hoisted files (e.g. expo-router's
// route context, which inlines the app root); with the default shared cache the outlet app
// could be served the partner app's routes.
config.cacheStores = [new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') })];

module.exports = withNativeWind(config, { input: './global.css' });
