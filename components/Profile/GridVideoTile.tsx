import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { theme } from '~/lib/theme';

interface GridVideoTileProps {
  videoUrl: string;
  /** Poster frame from json_metadata.images. Absent on clips posted before the
   *  transcoder started returning one — those fall back to the player. */
  thumbnailUrl?: string | null;
  size: number;
  onPress: () => void;
  isVisible?: boolean;
}

/**
 * A video post in the profile grid.
 *
 * With a poster, the tile is a still image and the clip only plays in the
 * immersive viewer `onPress` opens — a ~30KB JPEG instead of a multi-megabyte
 * fetch, so a screenful of clips no longer starves itself for bandwidth and
 * decoder slots.
 *
 * Without one it falls back to the player, because a poster-less tile has
 * nothing else to show. Mounting is gated on visibility so offscreen clips don't
 * decode. That path is slow, and stays slow until the clip has a poster.
 */
export const GridVideoTile = React.memo(({ videoUrl, thumbnailUrl, size, onPress, isVisible = false }: GridVideoTileProps) => {
  return (
    <Pressable
      style={[styles.tile, { width: size, height: size }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Video post"
      accessibilityHint="Double tap to open and play"
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.poster} contentFit="cover" />
      ) : isVisible ? (
        <VideoPlayer
          url={videoUrl}
          playing
          contentFit="cover"
          showControls={false}
          showMuteButton={false}
          initialMuted={true}
          loop={false}
        />
      ) : null}
      {/* Marks the tile as a video — a poster is otherwise indistinguishable
          from a photo post. */}
      <View style={styles.badge}>
        <Ionicons name="play" size={12} color={theme.colors.white} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryCard,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
