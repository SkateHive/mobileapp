// MapLibre draws the spot map on Android only (iOS keeps Apple Maps through
// react-native-maps), so keep its native code out of the iOS build: no pod,
// no change to the iOS binary.
module.exports = {
  dependencies: {
    "@maplibre/maplibre-react-native": {
      platforms: { ios: null },
    },
  },
};
