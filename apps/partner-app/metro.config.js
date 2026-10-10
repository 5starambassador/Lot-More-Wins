const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');
const { FileStore } = require('metro-cache');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// This app has its own install (see pnpm-workspace.yaml here): everything resolves from its own
// node_modules, never the monorepo root's, which holds the other apps' older React / React Native.
// Only the shared packages are read from outside the app.
const packagesDir = path.join(monorepoRoot, 'packages');
config.watchFolders = [packagesDir];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// pnpm links workspace packages (@lotmorewins/*) as junctions to their absolute C:\ path.
// When the repo is opened through a mapped drive (`subst L:`, used to stay under Windows'
// path-length limit for release builds) Metro cannot follow a link across drives, so resolve
// those packages from the monorepo's own packages/ folder. Metro only consults this when
// normal node_modules resolution fails, so the usual C:\ setup is unaffected.
config.resolver.extraNodeModules = Object.fromEntries(
  fs
    .readdirSync(packagesDir)
    .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
    .map((dir) => [require(path.join(packagesDir, dir, 'package.json')).name, path.join(packagesDir, dir)]),
);

// Own transform cache: expo-router's hoisted _ctx files share a path across both Expo apps,
// so a shared cache can serve the outlet app's routes here.
config.cacheStores = [new FileStore({ root: path.join(projectRoot, 'node_modules', '.cache', 'metro') })];

module.exports = withNativeWind(config, { input: './global.css' });
