import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { useInView } from '~/lib/hooks/useInView';
import { theme } from '~/lib/theme';

interface GridVideoTileProps {
  videoUrl: string;
  size: number;
  onPress: () => void;
}

export const GridVideoTile = React.memo(({ videoUrl, size, onPress }: GridVideoTileProps) => {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const [shouldRenderVideo, setShouldRenderVideo] = React.useState(false);

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isInView) {
      // Small delay to ensure we only load videos the user stops on
      timeout = setTimeout(() => setShouldRenderVideo(true), 500);
    } else {
      setShouldRenderVideo(false);
    }
    return () => clearTimeout(timeout);
  }, [isInView]);

  return (
    <Pressable
      ref={ref}
      style={[styles.tile, { width: size, height: size }]}
      onPress={onPress}
    >
      {shouldRenderVideo ? (
        <VideoPlayer
          url={videoUrl}
          playing={isInView}
          contentFit="cover"
          showControls={false}
          showMuteButton={false}
          initialMuted={true}
          loop={false}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="play" size={size / 3} color="rgba(255,255,255,0.4)" />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});
