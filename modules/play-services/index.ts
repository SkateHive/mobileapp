import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

interface PlayServicesNativeModule {
  isAvailable(): boolean;
}

// Android only (see expo-module.config.json); everywhere else it is absent.
let nativeModule: PlayServicesNativeModule | null = null;
if (Platform.OS === "android") {
  try {
    nativeModule = requireNativeModule("PlayServices");
  } catch {
    nativeModule = null;
  }
}

/** True when Google Play services is installed, enabled and up to date. */
export function isPlayServicesAvailable(): boolean {
  try {
    return nativeModule?.isAvailable() ?? false;
  } catch {
    return false;
  }
}
