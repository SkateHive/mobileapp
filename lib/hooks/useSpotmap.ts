import { useQuery } from "@tanstack/react-query";
import {
  fetchAllSpots,
  fetchSpotById,
  fetchFeaturedSpot,
  type FeaturedResponse,
} from "~/lib/spotmap/api";
import type { SpotmapRow } from "~/lib/spotmap/types";

const FIVE_MIN = 5 * 60 * 1000;

/** All spots for the map. Cached 5 min to match the endpoint's edge cache. */
export function useAllSpots() {
  return useQuery<SpotmapRow[]>({
    queryKey: ["spotmap", "all"],
    queryFn: ({ signal }) => fetchAllSpots(signal),
    staleTime: FIVE_MIN,
    gcTime: 30 * 60 * 1000,
  });
}

/** Single spot detail (images + kml_description). */
export function useSpot(id: string | undefined) {
  return useQuery<SpotmapRow>({
    queryKey: ["spotmap", "spot", id],
    queryFn: ({ signal }) => fetchSpotById(id as string, signal),
    enabled: !!id,
    staleTime: FIVE_MIN,
  });
}

/** Featured spot for the homepage discovery widget. */
export function useFeaturedSpot(opts: {
  lat?: number;
  lng?: number;
  exclude?: string[];
  enabled?: boolean;
}) {
  return useQuery<FeaturedResponse>({
    queryKey: ["spotmap", "featured", opts.lat, opts.lng, opts.exclude],
    queryFn: ({ signal }) =>
      fetchFeaturedSpot({
        lat: opts.lat,
        lng: opts.lng,
        exclude: opts.exclude,
        signal,
      }),
    enabled: opts.enabled ?? true,
    staleTime: 0, // each call should re-roll
  });
}
