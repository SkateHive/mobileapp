import * as Location from "expo-location";
import { LocationManager, type GeolocationPosition } from "@maplibre/maplibre-react-native";
import { isPlayServicesAvailable } from "~/modules/play-services";
import type { CurrentPosition } from "./current-position";

// expo-location on Android only reads Google's fused location service, so on
// a phone without Google Play services (GrapheneOS) it never answers.
// MapLibre's location engine falls back to Android's own LocationManager, so
// use it there.
const WAIT_FOR_FIX_MS = 15000;

function fromMapLibre(p: GeolocationPosition): CurrentPosition {
  return { coords: { latitude: p.coords.latitude, longitude: p.coords.longitude } };
}

export async function getCurrentPosition(): Promise<CurrentPosition> {
  if (isPlayServicesAvailable()) {
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  }

  const last = await LocationManager.getCurrentPosition();
  if (last) return fromMapLibre(last);

  // No recent fix: listen until the first one arrives.
  return new Promise<CurrentPosition>((resolve, reject) => {
    const onUpdate = (p: GeolocationPosition) => {
      clearTimeout(timer);
      LocationManager.removeListener(onUpdate);
      resolve(fromMapLibre(p));
    };
    const timer = setTimeout(() => {
      LocationManager.removeListener(onUpdate);
      reject(new Error("No location fix"));
    }, WAIT_FOR_FIX_MS);
    LocationManager.addListener(onUpdate);
  });
}
