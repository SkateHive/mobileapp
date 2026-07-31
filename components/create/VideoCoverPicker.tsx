import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, type VideoThumbnail } from "expo-video";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";

const FRAME_COUNT = 10;
// Big enough to stay sharp as a profile-grid tile, small enough to upload fast.
const MAX_FRAME_WIDTH = 720;

interface VideoCoverPickerProps {
  videoUri: string;
  /** Local file URI of the chosen frame, ready to upload. Null while none is picked. */
  onSelect: (uri: string | null) => void;
  disabled?: boolean;
}

/**
 * Lets the author pick which frame represents a video post.
 *
 * The chosen frame becomes `json_metadata.images[0]` — what the profile grid shows —
 * and the Instagram Reel cover. Frames are pulled from the local file before upload,
 * so this costs no network. Without a choice the first frame is used, which keeps
 * posting a two-tap flow.
 */
export function VideoCoverPicker({ videoUri, onSelect, disabled }: VideoCoverPickerProps) {
  const [frames, setFrames] = useState<VideoThumbnail[]>([]);
  const [selected, setSelected] = useState(0);
  const [isWorking, setIsWorking] = useState(true);

  const player = useVideoPlayer(videoUri, (p) => {
    p.muted = true;
  });

  // Turn a native thumbnail reference into a file the uploader can read.
  const emit = useCallback(
    async (thumb: VideoThumbnail | undefined) => {
      if (!thumb) return onSelect(null);
      try {
        const rendered = await ImageManipulator.manipulate(thumb).renderAsync();
        // The same file serves two masters: the profile grid wants it small (the
        // tile is ~390px wide) and the Reel cover wants it sharp. 720px at 0.7
        // splits the difference — full quality here produced ~400KB files, more
        // than ten times the poster the transcoder used to generate.
        const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
        onSelect(saved.uri);
      } catch {
        // Falling back to no cover just means the transcoder picks the frame,
        // which is the pre-existing behaviour.
        onSelect(null);
      }
    },
    [onSelect]
  );

  useEffect(() => {
    let cancelled = false;

    const extract = async () => {
      const duration = player.duration;
      if (!duration || duration <= 0) return;
      try {
        // Evenly spread across 10%–90%, skipping the very first and last moments:
        // those tend to be black frames or the rider still setting up. Starting at
        // 10% also keeps the default frame where the transcoder used to take it,
        // so not choosing gives the same result as before.
        const times = Array.from(
          { length: FRAME_COUNT },
          (_, i) => duration * (0.1 + (0.8 * i) / (FRAME_COUNT - 1))
        );
        const thumbs = await player.generateThumbnailsAsync(times, {
          maxWidth: MAX_FRAME_WIDTH,
        });
        if (cancelled) return;
        setFrames(thumbs);
        setSelected(0);
        await emit(thumbs[0]);
      } catch {
        if (!cancelled) onSelect(null);
      } finally {
        if (!cancelled) setIsWorking(false);
      }
    };

    // duration is only known once the player has loaded the file.
    if (player.duration > 0) {
      extract();
    } else {
      const sub = player.addListener("statusChange", ({ status }) => {
        if (status === "readyToPlay") {
          sub?.remove();
          extract();
        } else if (status === "error") {
          // Unreadable file: stop showing a spinner that will never resolve. The
          // post still goes through, with the transcoder picking the frame.
          sub?.remove();
          if (!cancelled) {
            setIsWorking(false);
            onSelect(null);
          }
        }
      });
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }

    return () => {
      cancelled = true;
    };
  }, [player, emit, onSelect]);

  const pick = useCallback(
    (index: number) => {
      setSelected(index);
      emit(frames[index]);
    },
    [frames, emit]
  );

  if (isWorking) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>COVER</Text>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (frames.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>COVER</Text>
      <Text style={styles.hint}>Shown on your profile grid — it can't be changed later.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {frames.map((frame, i) => (
          <Pressable
            key={i}
            onPress={() => pick(i)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Cover option ${i + 1} of ${frames.length}`}
            accessibilityState={{ selected: i === selected }}
            style={[styles.frame, i === selected && styles.frameSelected]}
          >
            <Image source={frame} style={styles.frameImage} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xxs,
  },
  hint: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  loading: {
    height: 64,
    justifyContent: "center",
  },
  strip: {
    gap: theme.spacing.sm,
  },
  frame: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  frameSelected: {
    borderColor: theme.colors.primary,
  },
  frameImage: {
    width: "100%",
    height: "100%",
  },
});
