// app.json is the config; this only adds the Android Google Maps key from the
// environment (.env, gitignored) so the key never lands in git. Without the
// key, Android draws the spot map with MapLibre instead.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: key },
      },
    },
    // Expo strips android.config from what the app can read at runtime, so
    // JS gets only this flag (never the key) to know Google Maps is set up.
    extra: { ...config.extra, androidGoogleMaps: true },
  };
};
