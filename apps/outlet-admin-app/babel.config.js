module.exports = function (api) {
  api.cache(true);
  return {
    // No NativeWind JSX transform: screens are styled with StyleSheet only, and its wrapper
    // around Pressable drops `style={({ pressed }) => ...}` callbacks (rows lost their layout).
    // babel-preset-expo adds the Reanimated (worklets) plugin itself.
    presets: ['babel-preset-expo'],
  };
};
