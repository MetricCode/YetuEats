const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Keep existing configuration
defaultConfig.resolver.assetExts.push('cjs');

// Add Firebase auth fix for Expo 53
defaultConfig.resolver.unstable_enablePackageExports = false;

// Make sure to properly resolve all file extensions
defaultConfig.resolver.sourceExts = [
  'js',
  'jsx',
  'json',
  'ts',
  'tsx',
  'cjs',
  'mjs',
];

module.exports = defaultConfig;