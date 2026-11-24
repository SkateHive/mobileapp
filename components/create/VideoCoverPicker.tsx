import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useVideoPlayer, VideoView, type VideoThumbnail } from "expo-video";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { t } from "~/lib/i18n";
import { coverTimeAt, stripTimeAt } from "~/lib/video-cover";

// Frames behind the cursor. They are a ruler, not the choice: the cover is
// whatever instant the cursor lands on, shown live in the video above it.
const STRIP_FRAMES = 10;
// Big enough to stay sharp as a profile-grid tile, small enough to upload fast.
const MAX_FRAME_WIDTH = 720;
const STRIP_HEIGHT = 56;
const CURSOR_WIDTH = 40;
// One screen-reader arrow press, as a share of the scrubbable range.
const STEP = 0.05;
// Shortest gap between two seeks while dragging. Each exact seek decodes from
// the previous keyframe, which Android in particular can't do every frame; the
// release always seeks to the final position anyway.
const SEEK_INTERVAL_MS = 50;

interface VideoCoverPickerProps {
  videoUri: string;
  /** Local file URI of the chosen frame, ready to upload. Null while none is picked. */
  onSelect: (uri: string | null) => void;
  /** True while a cover file is still being written, so the caller can hold off. */
  onPendingChange?: (pending: boolean) => void;
  disabled?: boolean;
}

/**
 * Lets the author pick which frame represents a video post.
 *
 * The chosen frame becomes `json_metadata.images[0]` — what the profile grid shows —
 * and the Instagram Reel cover. Frames are pulled from the local file before upload,
 * so this costs no network. Without a choice the 10% mark is used, which keeps
 * posting a two-tap flow.
 *
 * Dragging moves a cursor over a filmstrip while the video above it seeks along,
 * so the author sees the exact frame under the finger. The cover file itself is
 * extracted on release, not during the drag: `generateThumbnailsAsync` is one
 * native decode per call and a long clip cannot keep up with a moving finger.
 */
export function VideoCoverPicker({
  videoUri,
  onSelect,
  onPendingChange,
  disabled,
}: VideoCoverPickerProps) {
  const [strip, setStrip] = useState<VideoThumbnail[]>([]);
  const [isWorking, setIsWorking] = useState(true);
  const [stripWidth, setStripWidth] = useState(0);

  // Only the newest pick may write the cover: a slow extraction from an earlier
  // position must not overwrite a newer one.
  const pickId = useRef(0);
  const lastSeek = useRef(0);
  const unmounted = useRef(false);
  useEffect(
    () => () => {
      unmounted.current = true;
    },
    []
  );

  const cursorX = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const travel = Math.max(0, stripWidth - CURSOR_WIDTH);

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
      onPendingChange?.(true);
      try {
        // One frame per tile, sampled at the tile's centre so the strip lines up
        // with what sits under the cursor. The extra time is the cursor's
        // resting position, which is the cover until the author drags.
        const times = Array.from({ length: STRIP_FRAMES }, (_, i) =>
          stripTimeAt(i, STRIP_FRAMES, duration)
        );
        times.push(coverTimeAt(0, 1, duration));
        const thumbs = await player.generateThumbnailsAsync(times, {
          maxWidth: MAX_FRAME_WIDTH,
        });
        if (cancelled) return;
        setStrip(thumbs.slice(0, STRIP_FRAMES));
        player.currentTime = coverTimeAt(0, 1, duration);
        await emit(thumbs[STRIP_FRAMES]);
      } catch {
        if (!cancelled) onSelect(null);
      } finally {
        if (!cancelled) {
          setIsWorking(false);
          onPendingChange?.(false);
        }
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
  }, [player, emit, onSelect, onPendingChange]);

  // Frame-accurate: currentTime seeks exactly, unlike seekBy. Drag updates are
  // throttled (force skips that, for the final position).
  const seekTo = useCallback(
    (x: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastSeek.current < SEEK_INTERVAL_MS) return;
      lastSeek.current = now;
      const duration = player.duration;
      if (duration > 0) player.currentTime = coverTimeAt(x, travel, duration);
    },
    [player, travel]
  );

  const pickAt = useCallback(
    async (x: number) => {
      const duration = player.duration;
      if (!duration || duration <= 0) return;
      const id = ++pickId.current;
      seekTo(x, true);
      onPendingChange?.(true);
      try {
        const [thumb] = await player.generateThumbnailsAsync(
          [coverTimeAt(x, travel, duration)],
          { maxWidth: MAX_FRAME_WIDTH }
        );
        if (id !== pickId.current || unmounted.current) return;
        await emit(thumb);
      } catch {
        // Keep the frame already chosen rather than dropping the cover.
      } finally {
        if (id === pickId.current && !unmounted.current) onPendingChange?.(false);
      }
    },
    [player, travel, emit, seekTo, onPendingChange]
  );

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(travel, Math.max(0, cursorX.value + delta * travel));
      cursorX.value = next;
      pickAt(next);
    },
    [travel, cursorX, pickAt]
  );

  // The cursor moves on the UI thread; each move asks the video to seek, which
  // never blocks the drag, and the cover file is extracted only on release.
  const pan = Gesture.Pan()
    .enabled(!disabled && travel > 0)
    // The picker sits inside the composer's ScrollView. Claiming the gesture
    // only past a horizontal threshold leaves vertical scrolling to the list,
    // and moving the cursor on activation rather than on touch means a scroll
    // that started here never drags the cover along with it.
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onStart((e) => {
      const next = Math.min(travel, Math.max(0, e.x - CURSOR_WIDTH / 2));
      cursorX.value = next;
      dragStart.value = next;
      runOnJS(seekTo)(next);
    })
    .onUpdate((e) => {
      cursorX.value = Math.min(travel, Math.max(0, dragStart.value + e.translationX));
      runOnJS(seekTo)(cursorX.value);
    })
    .onEnd(() => {
      runOnJS(pickAt)(cursorX.value);
    });

  // A tap never travels far enough to activate the pan, so it needs its own
  // gesture: tapping the strip jumps the cursor there.
  const tap = Gesture.Tap()
    .enabled(!disabled && travel > 0)
    .onEnd((e) => {
      const next = Math.min(travel, Math.max(0, e.x - CURSOR_WIDTH / 2));
      cursorX.value = next;
      runOnJS(pickAt)(next);
    });

  const scrub = Gesture.Race(pan, tap);

  const cursorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cursorX.value }],
  }));

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={styles.container}>
        <Text style={styles.label}>{t("create.cover.label")}</Text>
        {isWorking ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : strip.length > 0 ? (
          <>
            <Text style={styles.hint}>{t("create.cover.hint")}</Text>
            <GestureDetector gesture={scrub}>
              <View
                style={styles.strip}
                onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("create.cover.frame_a11y")}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "increment") step(STEP);
                  else if (e.nativeEvent.actionName === "decrement") step(-STEP);
                }}
              >
                {strip.map((frame, i) => (
                  <Image key={i} source={frame} style={styles.stripFrame} contentFit="cover" />
                ))}
                <Animated.View style={[styles.cursor, cursorStyle]} pointerEvents="none" />
              </View>
            </GestureDetector>
          </>
        ) : null}
      </View>
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
  root: {
    flex: 1,
  },
  // Takes whatever height the strip leaves, so it fits any screen.
  video: {
    flex: 1,
    width: "100%",
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.black,
  },
  strip: {
    flexDirection: "row",
    height: STRIP_HEIGHT,
    borderRadius: theme.borderRadius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.secondaryCard,
  },
  stripFrame: {
    flex: 1,
    height: "100%",
  },
  cursor: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CURSOR_WIDTH,
    height: STRIP_HEIGHT,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(50,205,50,0.15)",
  },
});
