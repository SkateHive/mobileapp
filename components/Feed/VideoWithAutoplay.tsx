import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { VideoPlayer } from './VideoPlayer';
import { IpfsVideoPlayer } from './IpfsVideoPlayer';
import { theme } from '../../lib/theme';

interface VideoWithAutoplayProps {
  url: string;
  isVisible?: boolean;
  style?: ViewStyle;
  requireInteraction?: boolean;
}

export function VideoWithAutoplay({
  url,
  isVisible = true,
  style,
  requireInteraction = false
}: VideoWithAutoplayProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const isIpfs = url.includes('ipfs');

  const shouldPlay = isVisible && (!requireInteraction || hasInteracted);

  const handlePress = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable style={styles.pressable} onPress={handlePress}>
        {isIpfs ? (
          <IpfsVideoPlayer url={url} playing={shouldPlay} />
        ) : (
          <VideoPlayer url={url} playing={shouldPlay} />
        )}

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
    backgroundColor: '#000',
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
