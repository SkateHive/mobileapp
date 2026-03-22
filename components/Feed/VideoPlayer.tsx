import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState, useRef } from "react";
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { VideoConfig } from "~/lib/config/VideoConfig";
import { useAppSettings } from "~/lib/AppSettingsContext";

interface VideoPlayerProps {
  url: string;
  playing?: boolean;
  shouldPreload?: boolean;
  style?: StyleProp<ViewStyle>;
  contentFit?: "contain" | "cover" | "fill";
  showControls?: boolean;
  showMuteButton?: boolean;
  initialMuted?: boolean;
  muted?: boolean; // Controlled mute state (from parent)
  onMuteToggle?: (muted: boolean) => void; // Callback for external mute control
  loop?: boolean;
  onPlaybackStarted?: () => void;
  author?: string;
  provider?: string;
}

export const VideoPlayer = React.memo(
  ({
    url,
    playing = true,
    shouldPreload = false,
    style,
    contentFit = "contain",
    showControls = true,
    showMuteButton,
    initialMuted = VideoConfig.autoPlayMuted,
    muted: controlledMuted,
    onMuteToggle,
    loop = true,
    onPlaybackStarted,
    author,
    provider = 'VideoPlayer',
  }: VideoPlayerProps) => {
    const isFocused = useIsFocused();
    const { settings, updateSettings } = useAppSettings();
    const isControlled = controlledMuted !== undefined;
    const [internalMuted, setInternalMuted] = useState(initialMuted);
    
    // Use global setting if not controlled, otherwise use controlled prop
    const isMuted = isControlled ? controlledMuted : settings.videoMuted;
    
    const startTime = useRef(Date.now());
    const logPrefix = `[${provider}]`;
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const identifier = author ? `@${author}` : url.split('/').pop();

    useEffect(() => {
      console.log(`${logPrefix} [${identifier}] MOUNTED at +${Date.now() - startTime.current}ms (playing: ${playing}, prefetch: ${shouldPreload})`);
    }, []);

    const isUpdatingFromPlayer = useRef(false);
    const hasNotifiedPlayback = useRef(false);
    const onPlaybackStartedRef = useRef(onPlaybackStarted);
    onPlaybackStartedRef.current = onPlaybackStarted;

    const player = useVideoPlayer(url, (player) => {
      console.log(`${logPrefix} [${identifier}] PLAYER_INIT at +${Date.now() - startTime.current}ms`);
      player.loop = loop;
    });

    // Track status changes
    useEffect(() => {
      const sub = player.addListener('statusChange', (event) => {
        console.log(`${logPrefix} [${identifier}] STATUS_CHANGE: ${event.status} at +${Date.now() - startTime.current}ms`);
        if (event.status === 'readyToPlay') setStatus('ready');
        if (event.status === 'loading') setStatus('loading');
        if (event.status === 'error') setStatus('error');
      });
      return () => sub.remove();
    }, [player, identifier]);

    // Set initial muted state after player is created (respecting global settings)
    useEffect(() => {
      player.muted = isMuted;
    }, [player, isMuted]);

    // Cleanup: pause player on unmount to free resources
    useEffect(() => {
      return () => {
        console.log(`${logPrefix} [${identifier}] UNMOUNTED at +${Date.now() - startTime.current}ms`);
        try { player.pause(); } catch {}
      };
    }, [player, identifier]);

    // Notify parent when video starts playing
    useEffect(() => {
      if (!playing || hasNotifiedPlayback.current) return;
      const subscription = player.addListener('playingChange', (event: { isPlaying: boolean }) => {
        if (event.isPlaying) {
          console.log(`${logPrefix} [${identifier}] PLAYING_STARTED at +${Date.now() - startTime.current}ms`);
          if (!hasNotifiedPlayback.current) {
            hasNotifiedPlayback.current = true;
            onPlaybackStartedRef.current?.();
          }
        }
      });
      return () => { subscription?.remove(); };
    }, [playing, player, identifier]);

    useEffect(() => {
      if (playing && isFocused) {
        console.log(`${logPrefix} [${identifier}] CALL_PLAY at +${Date.now() - startTime.current}ms`);
        player.play();
      } else {
        console.log(`${logPrefix} [${identifier}] CALL_PAUSE at +${Date.now() - startTime.current}ms`);
        player.pause();
      }
    }, [playing, isFocused, player, identifier]);

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

      const subscription = player.addListener(
        "mutedChange",
        (event: { muted: boolean }) => {
          isUpdatingFromPlayer.current = true;
          if (isControlled) {
            onMuteToggle?.(event.muted);
          } else {
            setInternalMuted(event.muted);
          }
        }
      );

      return () => {
        subscription?.remove();
      };
    }, [player, showControls]);

    const toggleMute = () => {
      const newMuted = !isMuted;
      updateSettings({ videoMuted: newMuted });
      if (isControlled) {
        onMuteToggle?.(newMuted);
      } else {
        setInternalMuted(newMuted);
      }
    };

    return (
      <View style={[styles.container, style]}>
        <VideoView
          style={styles.video}
          contentFit={contentFit}
          player={player}
          nativeControls={showControls}
        />

        {/* Custom mute/unmute button when native controls are hidden */}
        {(showMuteButton ?? !showControls) && (
          <Pressable
            style={styles.muteButton}
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
            accessibilityState={{ selected: isMuted }}
            accessibilityHint={
              isMuted ? "Double tap to unmute" : "Double tap to mute"
            }
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
