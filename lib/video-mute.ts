import { useCallback, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

const KEY = "video_muted";

/**
 * One app-wide mute choice, shared by every player and persisted.
 *
 * It stays `null` until the user actually taps a speaker, and each surface
 * passes its own fallback for that case: the feed autoplays silently (nobody
 * wants a timeline that talks), while the Videos tab and the immersive viewer
 * start with sound, since you navigated to a full-screen player on purpose.
 * After the first tap the choice follows you everywhere — that's what other
 * video apps do, and having to unmute every single clip is the actual
 * complaint in #42.
 */
let choice: boolean | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

SecureStore.getItemAsync(KEY)
  .then((v) => {
    if (v === "0" || v === "1") {
      choice = v === "1";
      emit();
    }
  })
  .catch(() => {
    // Never chosen, or storage unavailable — surface defaults apply.
  });

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVideoMuted(
  defaultMuted: boolean
): [boolean, (muted: boolean) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => choice,
    () => choice
  );

  const setMuted = useCallback((muted: boolean) => {
    choice = muted;
    emit();
    SecureStore.setItemAsync(KEY, muted ? "1" : "0").catch(() => {
      // A preference that won't persist still works for this session.
    });
  }, []);

  return [stored ?? defaultMuted, setMuted];
}
