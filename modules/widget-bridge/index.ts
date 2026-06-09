import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

interface WidgetBridgeNativeModule {
  setNearbySpots(json: string): void;
  clear(): void;
}

// Only present on iOS dev/standalone builds (not Expo Go / web). Resolve once,
// tolerate absence so the JS API is always safe to call.
let nativeModule: WidgetBridgeNativeModule | null = null;
if (Platform.OS === "ios") {
  try {
    nativeModule = requireNativeModule("WidgetBridge");
  } catch {
    nativeModule = null;
  }
}

export const isWidgetBridgeAvailable = nativeModule != null;

/** Persist the nearby-spots payload (JSON string) to the App Group and reload the widget. */
export function setNearbySpots(json: string): void {
  nativeModule?.setNearbySpots(json);
}

/** Clear the stored payload (widget falls back to its empty state). */
export function clearNearbySpots(): void {
  nativeModule?.clear();
}
