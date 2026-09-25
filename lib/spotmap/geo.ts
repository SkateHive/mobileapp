// Pure geo helpers for the spot map — no native deps.

import type { TFunction } from "../i18n/translate";
import type { SpotmapRow } from "./types";

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** [west, south, east, north] bounding box for a MapView region. */
export function regionToBounds(
  r: Region,
): [number, number, number, number] {
  const west = r.longitude - r.longitudeDelta / 2;
  const east = r.longitude + r.longitudeDelta / 2;
  const south = r.latitude - r.latitudeDelta / 2;
  const north = r.latitude + r.latitudeDelta / 2;
  return [west, south, east, north];
}

/** Spots whose coordinates fall inside the visible region. */
export function spotsInRegion(
  spots: SpotmapRow[],
  region: Region,
): SpotmapRow[] {
  const [west, south, east, north] = regionToBounds(region);
  return spots.filter(
    (s) =>
      s.lat >= south && s.lat <= north && s.lng >= west && s.lng <= east,
  );
}

/** Approximate zoom level (0–20) from a region's longitude span. */
export function regionToZoom(region: Region): number {
  return Math.round(Math.log2(360 / region.longitudeDelta));
}

/**
 * `t` and `decimal` are passed in so this module stays free of React Native imports;
 * `decimal` writes the locale's separator ("1,2" in Portuguese and Spanish).
 */
export function formatDistance(
  km: number,
  t: TFunction,
  decimal: (value: number, digits: number) => string,
): string {
  if (km < 1) return t("map.distance.m", { n: Math.round(km * 1000) });
  if (km < 10) return t("map.distance.km", { n: decimal(km, 1) });
  return t("map.distance.km", { n: Math.round(km) });
}
