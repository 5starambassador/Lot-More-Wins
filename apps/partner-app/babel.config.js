module.exports = function (api) {
  api.cache(true);
  return {
    // No NativeWind JSX transform: screens are styled with StyleSheet only, and its wrapper
    // around Pressable drops `style={({ pressed }) => ...}` callbacks (rows lost their layout).
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
