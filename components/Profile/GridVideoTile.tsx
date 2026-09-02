import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { theme } from '~/lib/theme';
import {
  getVideoFirstFrame,
  requestVideoFirstFrame,
  subscribeVideoFirstFrame,
} from '~/lib/video-thumbnails';

/**
 * Which grid tiles are on screen, kept outside React state.
 *
 * The list's viewability callback fires on every scroll tick. Held in state it
 * re-created renderItem each time, which re-rendered every cell in the window;
 * held here, only the one tile that subscribes (the autoplaying clip) hears
 * about it.
 */
export interface TileVisibility {
  update: (permlinks: string[]) => void;
  has: (permlink: string) => boolean;
  subscribe: (listener: () => void) => () => void;
}

export function createTileVisibility(): TileVisibility {
  let visible = new Set<string>();
  const listeners = new Set<() => void>();
  return {
    update(permlinks) {
      visible = new Set(permlinks);
      listeners.forEach((l) => l());
    },
    has: (permlink) => visible.has(permlink),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function useTileVisible(visibility: TileVisibility, permlink: string): boolean {
  return useSyncExternalStore(visibility.subscribe, () => visibility.has(permlink));
}

/** Poster from the session cache, extracting it on first use. */
function useVideoFirstFrame(permlink: string, url: string, enabled: boolean): string | null {
  const subscribe = useCallback(
    (listener: () => void) => subscribeVideoFirstFrame(permlink, listener),
    [permlink]
  );
  const uri = useSyncExternalStore(subscribe, () => getVideoFirstFrame(permlink));
  useEffect(() => {
    if (enabled && !uri) requestVideoFirstFrame(permlink, url);
  }, [enabled, uri, permlink, url]);
  return uri;
}

interface GridVideoTileProps {
  permlink: string;
  videoUrl: string;
  /** Poster frame from json_metadata.images. Absent on clips posted before the
   *  transcoder started returning one — those get a locally extracted frame. */
  thumbnailUrl?: string | null;
  size: number;
  index: number;
  onPress: (index: number) => void;
  /** The one tile in the grid that plays inline. Everything else is a still. */
  autoplay: boolean;
  visibility: TileVisibility;
}

/**
 * A video post in the profile grid.
 *
 * Exactly one tile — the first video in the grid — owns a player. It stays
 * mounted for as long as the tile does and is paused, not destroyed, when it
 * scrolls away, so coming back doesn't refetch the clip. Its poster covers the
 * surface until the first frame renders.
 *
 * Every other tile is an image: the transcoder's poster when the post has one,
 * otherwise a first frame extracted once per session (see lib/video-thumbnails).
 * While that extracts, the tile shows the card colour and a play glyph rather
 * than a black square.
 */
export const GridVideoTile = React.memo(
  ({ permlink, videoUrl, thumbnailUrl, size, index, onPress, autoplay, visibility }: GridVideoTileProps) => {
    const isFocused = useIsFocused();
    const isVisible = useTileVisible(visibility, permlink);
    const generated = useVideoFirstFrame(permlink, videoUrl, !autoplay && !thumbnailUrl);
    const [hasFrames, setHasFrames] = useState(false);
    const handlePress = useCallback(() => onPress(index), [onPress, index]);
    const onPlaybackStarted = useCallback(() => setHasFrames(true), []);

    const poster = thumbnailUrl ?? generated;

    return (
      <Pressable
        style={[styles.tile, { width: size, height: size }]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Video post"
        accessibilityHint="Double tap to open and play"
      >
        {autoplay ? (
          <>
            <VideoPlayer
              url={videoUrl}
              playing={isFocused && isVisible}
              contentFit="cover"
              showControls={false}
              showMuteButton={false}
              initialMuted={true}
              loop={true}
              onPlaybackStarted={onPlaybackStarted}
            />
            {!hasFrames && poster ? (
              <Image
                source={{ uri: poster }}
                style={styles.posterOverlay}
                contentFit="cover"
                recyclingKey={permlink}
                transition={0}
              />
            ) : null}
          </>
        ) : poster ? (
          <Image
            source={{ uri: poster }}
            style={styles.poster}
            contentFit="cover"
            recyclingKey={permlink}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="play-outline" size={28} color={theme.colors.muted} />
          </View>
        )}
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryCard,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
