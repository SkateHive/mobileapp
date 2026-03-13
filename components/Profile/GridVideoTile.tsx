import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { useInView } from '~/lib/hooks/useInView';
import { theme } from '~/lib/theme';

interface GridVideoTileProps {
  videoUrl: string;
  size: number;
  onPress: () => void;
}

export const GridVideoTile = React.memo(({ videoUrl, size, onPress }: GridVideoTileProps) => {
  const { ref, isInView } = useInView({ threshold: 0.3 });

  return (
    <Pressable
      ref={ref}
      style={[styles.tile, { width: size, height: size }]}
      onPress={onPress}
    >
      <VideoPlayer
        url={videoUrl}
        playing={isInView}
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
