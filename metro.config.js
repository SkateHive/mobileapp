const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add Buffer polyfill
config.resolver.alias = {
  ...config.resolver.alias,
  buffer: require.resolve('buffer'),
};

module.exports = withNativeWind(config, { input: './global.css' });
