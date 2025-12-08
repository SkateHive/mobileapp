import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState, useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface VideoPlayerProps {
  url: string;
  playing?: boolean;
  contentFit?: "contain" | "cover" | "fill";
  showControls?: boolean;
  initialMuted?: boolean;
}

export const VideoPlayer = React.memo(
  ({
    url,
    playing = true,
    contentFit = "contain",
    showControls = true,
    initialMuted = true,
  }: VideoPlayerProps) => {
    const [isMuted, setIsMuted] = useState(initialMuted);
    const isUpdatingFromPlayer = useRef(false);

    const player = useVideoPlayer(url, (player) => {
      player.loop = true;
    });

    // Set initial muted state after player is created
    useEffect(() => {
      player.muted = initialMuted;
    }, []);

    useEffect(() => {
      if (playing) {
        player.play();
      } else {
        player.pause();
      }
    }, [playing, player]);

    // Sync React state -> player (when user taps custom button)
    useEffect(() => {
      if (!isUpdatingFromPlayer.current) {
        player.muted = isMuted;
      }
      isUpdatingFromPlayer.current = false;
    }, [isMuted, player]);

    // Listen to native control changes (only when native controls are shown)
    useEffect(() => {
      if (!showControls) return;

      const subscription = player.addListener("mutedChange", (event: { muted: boolean }) => {
        isUpdatingFromPlayer.current = true;
        setIsMuted(event.muted);
      });

      return () => {
        subscription?.remove();
      };
    }, [player, showControls]);

    const toggleMute = () => {
      setIsMuted((prev) => !prev);
    };

    return (
      <View style={styles.container}>
        <VideoView
          style={styles.video}
          contentFit={contentFit}
          player={player}
          nativeControls={showControls}
        />

        {/* Custom mute/unmute button when native controls are hidden */}
        {!showControls && (
          <Pressable 
            style={styles.muteButton} 
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
            accessibilityState={{ selected: isMuted }}
            accessibilityHint={isMuted ? "Double tap to unmute" : "Double tap to mute"}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={24}
              color="#fff"
            />
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  muteButton: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});
