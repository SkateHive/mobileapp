import React, { useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { theme } from "~/lib/theme";

const CLIP = require("../../assets/videos/background.mp4");

/** Scrim per screen — the collage is busy, and how busy varies. */
const SCRIMS = {
  // Controls sit at the bottom, so the dark end is down there.
  bottom: { colors: theme.auth.scrimBottom, locations: theme.auth.scrimBottomStops },
  // Content sits at the top and the keypad covers the rest: darker throughout.
  top: { colors: theme.auth.scrimTop, locations: theme.auth.scrimTopStops },
} as const;

/**
 * The video collage behind every sign-in screen, with the scrim that makes text
 * on top of it readable (#60).
 *
 * One component so the login screen and the code screen share a single player
 * and identical treatment — they used to disagree, one showing the collage and
 * the other flat black.
 */
export function AuthBackground({ scrim = "bottom" }: { scrim?: keyof typeof SCRIMS }) {
  const player = useVideoPlayer(CLIP, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Play only while this screen is the one in front. Pushing a sign-in screen
  // leaves the one underneath mounted, and its clip came back frozen once the
  // player on top was torn down — playing on focus fixes that, and pausing
  // offscreen stops two copies of the same video decoding at once.
  const isFocused = useIsFocused();
  useEffect(() => {
    try {
      if (isFocused) player.play();
      else player.pause();
    } catch {
      // Native player already released during unmount.
    }
  }, [isFocused, player]);

  // iOS pauses playback when the app goes to the background, and screen focus
  // never changes across that — so without this the clip comes back frozen.
  // Pausing on the way out matters too: nothing should decode off-screen.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      try {
        if (state === "active" && isFocused) player.play();
        else player.pause();
      } catch {}
    });
    return () => sub.remove();
  }, [isFocused, player]);

  const { colors, locations } = SCRIMS[scrim];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        player={player}
        nativeControls={false}
      />
      <LinearGradient
        colors={colors}
        locations={locations}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
