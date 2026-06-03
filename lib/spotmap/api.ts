// REST client for the public Skatehive spot-map endpoints.
// These live on the web app origin (skatehive.app), NOT api.skatehive.app.
// All endpoints are public / no auth and edge-cached ~5 min.

import type { SpotmapRow } from "./types";

const SPOTMAP_BASE = "https://skatehive.app/api/spotmap";

interface SpotListResponse {
  success: boolean;
  count: number;
  spots: SpotmapRow[];
}

interface SpotResponse {
  success: boolean;
  spot: SpotmapRow;
}

export interface FeaturedResponse {
  success: boolean;
  spot: SpotmapRow | null;
  isNearby: boolean;
  pool_size: number;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Spotmap request failed (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

/** Full list — ~586 rows, ~200 KB. Use once for the map screen, filter client-side. */
export async function fetchAllSpots(signal?: AbortSignal): Promise<SpotmapRow[]> {
  const data = await getJson<SpotListResponse>(SPOTMAP_BASE, signal);
  if (!data.success || !Array.isArray(data.spots)) {
    throw new Error("Spotmap list response malformed");
  }
  // Guard against rows with bad coordinates — they'd crash the map projection.
  return data.spots.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      Math.abs(s.lat) <= 90 &&
      Math.abs(s.lng) <= 180,
  );
}

/** Single spot by uuid — includes images + kml_description for the detail screen. */
export async function fetchSpotById(
  id: string,
  signal?: AbortSignal,
): Promise<SpotmapRow> {
  const data = await getJson<SpotResponse>(
    `${SPOTMAP_BASE}/${encodeURIComponent(id)}`,
    signal,
  );
  if (!data.success || !data.spot) {
    throw new Error(`Spot ${id} not found`);
  }
  return data.spot;
}

/**
 * Server picks one spot at random from the 10 nearest (within 80 km of
 * lat/lng) or the 30 newest. `exclude` is a comma-joined list of seen ids.
 */
export async function fetchFeaturedSpot(opts: {
  lat?: number;
  lng?: number;
  exclude?: string[];
  signal?: AbortSignal;
}): Promise<FeaturedResponse> {
  const params = new URLSearchParams();
  if (opts.lat != null) params.set("lat", String(opts.lat));
  if (opts.lng != null) params.set("lng", String(opts.lng));
  if (opts.exclude?.length) params.set("exclude", opts.exclude.join(","));
  const qs = params.toString();
  return getJson<FeaturedResponse>(
    `${SPOTMAP_BASE}/featured${qs ? `?${qs}` : ""}`,
    opts.signal,
  );
}
