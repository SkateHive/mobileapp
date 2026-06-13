import { useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetchAllSpots } from "~/lib/spotmap/api";
import { syncSpotWidget, type UserLoc } from "~/lib/widgets/spotWidget";

const LOC_KEY = "last_user_loc";

/** Remember the last location the user resolved on the Map tab. */
export async function persistUserLoc(loc: UserLoc): Promise<void> {
  try {
    await SecureStore.setItemAsync(LOC_KEY, JSON.stringify(loc));
  } catch {
    // Non-fatal — widget just won't refresh outside the Map screen.
  }
}

/** Last location we saved — lets the map center instantly before a fresh GPS fix. */
export async function loadPersistedUserLoc(): Promise<UserLoc | null> {
  try {
    const raw = await SecureStore.getItemAsync(LOC_KEY);
    return raw ? (JSON.parse(raw) as UserLoc) : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the iOS widget fresh: on app open and every time it returns to the
 * foreground, recomputes nearby spots from the last-known location and pushes
 * them to the widget. Does nothing until the user has resolved a location once.
 */
export function useSpotWidgetSync(): void {
  const running = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const raw = await SecureStore.getItemAsync(LOC_KEY);
        if (!raw) return; // no location yet → widget stays in its empty state
        const loc = JSON.parse(raw) as UserLoc;
        const spots = await fetchAllSpots(); // edge-cached (~5 min)
        syncSpotWidget(loc, spots);
      } catch {
        // Ignore — best-effort background refresh.
      } finally {
        running.current = false;
      }
    };

    run();
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") run();
    });
    return () => sub.remove();
  }, []);
}
