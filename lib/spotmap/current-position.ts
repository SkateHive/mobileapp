import * as Location from "expo-location";

export interface CurrentPosition {
  coords: { latitude: number; longitude: number };
}

/**
 * The phone's current position, for "Near me" and placing a new spot.
 * Callers check the location permission first. Rejects when there is no fix.
 * Android has its own version (current-position.android.ts) for phones
 * without Google Play services.
 */
export function getCurrentPosition(): Promise<CurrentPosition> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}
