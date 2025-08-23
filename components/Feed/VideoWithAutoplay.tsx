import React, { useState, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { VideoPlayer } from './VideoPlayer';
import { useInView } from '../../lib/hooks/useInView';
import { theme } from '../../lib/theme';

interface VideoWithAutoplayProps {
  url: string;
  isVisible?: boolean;
  style?: ViewStyle;
  requireInteraction?: boolean; // New prop to control autoplay behavior
}

export function VideoWithAutoplay({ 
  url, 
  isVisible = true, 
  style, 
  requireInteraction = false 
}: VideoWithAutoplayProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const { ref, isInView } = useInView({ threshold: 0.5 });
  
  // Video should play if:
  // 1. It's currently in view (both parent visibility and intersection observer)
  // 2. The parent component says it's visible
  // 3. If requireInteraction is true, user must have interacted with it
  const shouldPlay = isInView && isVisible && (!requireInteraction || hasInteracted);
  
  const handlePress = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };
  
  return (
    <View ref={ref} style={[styles.container, style]}>
      <Pressable style={styles.pressable} onPress={handlePress}>
        <VideoPlayer 
          url={url} 
          playing={shouldPlay}
        />
        
        {/* Show play button overlay only if interaction is required and video hasn't been interacted with */}
        {requireInteraction && !hasInteracted && (
          <View style={styles.playOverlay}>
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
  },
  pressable: {
    width: '100%',
    height: '100%',
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
