import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { theme } from '~/lib/theme';

interface GridVideoTileProps {
  videoUrl: string;
  size: number;
  onPress: () => void;
  isVisible?: boolean;
}

export const GridVideoTile = React.memo(({ videoUrl, size, onPress, isVisible = false }: GridVideoTileProps) => {
  return (
    <Pressable
      style={[styles.tile, { width: size, height: size }]}
      onPress={onPress}
    >
      <VideoPlayer
        url={videoUrl}
        playing={isVisible}
        contentFit="cover"
        showControls={false}
        showMuteButton={false}
        initialMuted={true}
        loop={false}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryCard,
  },
});
