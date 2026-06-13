import { Platform } from "react-native";
import { setNearbySpots } from "~/modules/widget-bridge";
import { distanceKm } from "~/lib/spotmap/geo";
import { spotHref, type SpotmapRow } from "~/lib/spotmap/types";

// How many spots to hand the widget. Small widget shows 1, large shows up to 4,
// and the iOS 17 map plots up to 15 — 6 covers all families with headroom.
const MAX_SPOTS = 6;

export interface UserLoc {
  lat: number;
  lng: number;
}

// Last payload signature pushed this session. Skipping identical pushes keeps the
// widget "comfortable" — no redundant reloads, which protects the iOS refresh budget.
let lastSignature: string | null = null;

/**
 * Computes the nearest spots to `userLoc` and pushes them to the iOS widget via
 * the App Group — but only when the result actually changed. No-op off iOS, with
 * no spots, or when the native module is absent (Expo Go / web).
 */
export function syncSpotWidget(userLoc: UserLoc, spots: SpotmapRow[]): void {
  if (Platform.OS !== "ios" || !spots?.length) return;

  const nearest = spots
    .map((s) => ({ s, d: distanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_SPOTS);

  // Signature = coarse location (~100m) + the ordered nearest ids. If unchanged,
  // the widget would render identically, so don't reload it.
  const signature = JSON.stringify([
    userLoc.lat.toFixed(3),
    userLoc.lng.toFixed(3),
    nearest.map(({ s }) => s.id),
  ]);
  if (signature === lastSignature) return;
  lastSignature = signature;

  const payload = {
    updatedAt: Date.now() / 1000,
    userLat: userLoc.lat,
    userLng: userLoc.lng,
    spots: nearest.map(({ s, d }) => ({
      id: s.id,
      name: s.name || "Unnamed spot",
      lat: s.lat,
      lng: s.lng,
      distanceKm: d,
      // Only surface a real Hive author; curated KML spots render as "Curated".
      author: s.source === "hive" ? s.hive_author ?? null : null,
      source: s.source,
      thumbnail: s.thumbnail ?? null,
      href: spotHref(s),
    })),
  };

  try {
    setNearbySpots(JSON.stringify(payload));
  } catch {
    // Native module unavailable — safe to ignore.
  }
}
