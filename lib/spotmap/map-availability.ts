import { Platform } from "react-native";
import Constants from "expo-constants";

// react-native-maps draws with Google Maps on Android, which needs an API key
// in the manifest. Without one the native MapView throws on creation and the
// whole app closes ("API key not found"), so the map screens check this first.
// iOS uses Apple Maps and needs nothing.
export const NATIVE_MAP_AVAILABLE =
  Platform.OS !== "android" ||
  Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);
