import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { VideoPlayer } from './VideoPlayer';
import { useInView } from '../../lib/hooks/useInView';
import { theme } from '../../lib/theme';
import { ThemedLoading } from '../ui/ThemedLoading';

interface VideoWithAutoplayProps {
  url: string;
  isVisible?: boolean;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  requireInteraction?: boolean; // New prop to control autoplay behavior
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
  const isFocused = useIsFocused();
  const { ref, isInView } = useInView({ threshold: 0.5 });
  
  // Video should play if:
  // 1. It's currently in view (both parent visibility and intersection observer)
  // 2. The parent component says it's visible
  // 3. The screen is focused (not in a background tab)
  // 4. If requireInteraction is true, user must have interacted with it
  const shouldPlay = isInView && isVisible && isFocused && (!requireInteraction || hasInteracted);
  
  const handlePress = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };
  
  return (
    <View ref={ref} style={[styles.container, style]}>
      <Pressable style={styles.pressable} onPress={handlePress}>
        {(Platform.OS === 'ios' || isInView) && (
          <VideoPlayer 
            url={url} 
            playing={shouldPlay}
            onPlaybackStarted={() => setIsPlaying(true)}
          />
        )}
        
        {/* Show play button overlay only if interaction is required and video hasn't been interacted with */}
        {requireInteraction && !hasInteracted && (
          <View style={styles.playOverlay}>
            <FontAwesome name="play-circle" size={50} color="white" />
          </View>
        )}

        {/* Thumbnail overlay until video plays */}
        {!isPlaying && (
          <>
            {thumbnailUrl ? (
              <View style={styles.posterOverlay}>
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.posterImage}
                  contentFit="cover"
                  transition={0}
                />
                {(!requireInteraction || hasInteracted) && (
                  <View style={styles.playIconOverlay}>
                    <ThemedLoading size="small" />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.spinnerOverlay}>
                {(!requireInteraction || hasInteracted) ? (
                  <ThemedLoading size="small" />
                ) : (
                  <FontAwesome name="play-circle" size={50} color="white" />
                )}
              </View>
            )}
          </>
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
    backgroundColor: '#000', // Black background for videos
  },
  pressable: {
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
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
});
