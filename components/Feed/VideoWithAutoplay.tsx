import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useVideoMuted } from '~/lib/video-mute';

interface VideoWithAutoplayProps {
  url: string;
  thumbnailUrl?: string | null;
  isVisible?: boolean;
  style?: ViewStyle;
  requireInteraction?: boolean;
}

export function VideoWithAutoplay({
  url,
  thumbnailUrl,
  isVisible = true,
  style,
  requireInteraction = false
}: VideoWithAutoplayProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Tab screens stay mounted when you leave them, so visibility alone would let
  // a clip keep playing (and, once unmuted, keep talking) from another tab.
  const isFocused = useIsFocused();
  const shouldPlay = isFocused && isVisible && (!requireInteraction || hasInteracted);

  // A timeline that autoplays with sound is bad behaviour, so the feed defaults
  // to muted — but the choice is shared, so unmuting here carries over.
  const [isMuted, setMuted] = useVideoMuted(true);

  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Native player may already be released (e.g. during tab switch / unmount)
    }
  }, [shouldPlay, player]);

  // Track when video actually starts rendering frames
  // Depends only on player — not isPlaying, to avoid accumulating duplicate subscriptions
  useEffect(() => {
    const sub = player.addListener('playingChange', (e: { isPlaying: boolean }) => {
      if (e.isPlaying) setIsPlaying(true);
    });
    return () => sub?.remove();
  }, [player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, [player]);

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={styles.pressable}
        onPress={() => !hasInteracted && setHasInteracted(true)}
      >
        {/* Native video player — no WebView */}
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />

        {/* Thumbnail overlay until video plays */}
        {!isPlaying && thumbnailUrl && (
          <View style={styles.posterOverlay}>
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.posterImage}
              contentFit="cover"
              transition={0}
            />
            <View style={styles.playIconOverlay}>
              <FontAwesome name="play-circle" size={40} color="rgba(255,255,255,0.8)" />
            </View>
          </View>
        )}

        {/* Spinner fallback when no thumbnail */}
        {!isPlaying && !thumbnailUrl && (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {requireInteraction && !hasInteracted && (
          <View style={styles.interactionOverlay}>
            <FontAwesome name="play-circle" size={50} color="white" />
          </View>
        )}
      </Pressable>

      {/* Outside the Pressable above so a tap here never counts as the
          "start playing" interaction. */}
      {isPlaying && (
        <Pressable
          style={styles.muteButton}
          onPress={() => setMuted(!isMuted)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
          accessibilityState={{ selected: !isMuted }}
        >
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={16}
            color="white"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  pressable: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  interactionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 3,
  },
});
