// Skate spot data model — mirrors the web app's `spotmap_spots` Supabase table.
// One URL pattern serves both sources: /spot/<author>/<permlink>.
// For Hive spots, (hive_author, hive_permlink) is the user's identity.
// For curated Google My Maps spots, hive_author is the literal "skatehive-map"
// and hive_permlink is the row's uuid.

export type SpotSource = "hive" | "google_my_maps";

export interface SpotImage {
  url: string;
  caption: string;
}

export interface SpotmapRow {
  id: string; // uuid
  source: SpotSource;
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
  thumbnail?: string | null;
  images?: SpotImage[] | null;
  hive_author?: string | null; // 'skatehive-map' for KML
  hive_permlink?: string | null; // row uuid for KML
  hive_created?: string | null;
  hive_last_update?: string | null;
  kml_feature_id?: string | null;
  kml_description?: string | null; // raw HTML, KML only
}

/** The synthetic author used for curated Google My Maps spots. */
export const KML_AUTHOR = "skatehive-map";

export function isHiveSpot(spot: Pick<SpotmapRow, "source">): boolean {
  return spot.source === "hive";
}

/** Canonical deep-link path for a spot — matches the web `/spot/<author>/<permlink>`. */
export function spotHref(spot: SpotmapRow): string {
  const author = spot.hive_author ?? KML_AUTHOR;
  const permlink = spot.hive_permlink ?? spot.id;
  return `/spot/${author}/${permlink}`;
}
