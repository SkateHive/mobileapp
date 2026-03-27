import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { FontAwesome } from '@expo/vector-icons';

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

  const shouldPlay = isVisible && (!requireInteraction || hasInteracted);

  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  // Track when video actually starts rendering frames
  useEffect(() => {
    const sub = player.addListener('playingChange', (e: { isPlaying: boolean }) => {
      if (e.isPlaying && !isPlaying) setIsPlaying(true);
    });
    return () => sub?.remove();
  }, [player, isPlaying]);

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
