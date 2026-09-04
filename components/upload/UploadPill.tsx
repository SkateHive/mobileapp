import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { isJobActive, pillDetail, pillLabel, type UploadJob } from "~/lib/upload/upload-job";
import { discard, dispatch, useUploadJob } from "~/lib/upload/upload-store";

const RING_SIZE = 44;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const THUMB_SIZE = RING_SIZE - RING_STROKE * 2 - 4;

function thumbnailUri(job: UploadJob): string | null {
  if (job.draft.coverUri) return job.draft.coverUri;
  if (job.draft.mediaKind === "image" && job.draft.mediaUri) return job.draft.mediaUri;
  return null;
}

function ProgressRing({ job }: { job: UploadJob }) {
  const indeterminate = job.pendingResume !== null || job.status === "publishing";
  const failed = job.status === "failed";
  const fraction = job.status === "published" ? 1 : indeterminate ? 0.25 : Math.min(1, Math.max(0, job.progress / 100));
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!indeterminate) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={theme.colors.border}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={failed ? theme.colors.danger : theme.colors.primary}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
    </Animated.View>
  );
}

export function UploadPill() {
  const job = useUploadJob();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Collapse again when the post goes out.
  useEffect(() => {
    if (job?.status === "published") setExpanded(false);
  }, [job?.status]);

  if (!job) return null;

  const uri = thumbnailUri(job);
  const failed = job.status === "failed";
  const published = job.status === "published";

  const onPress = () => {
    if (published) {
      const { author, permlink } = job;
      discard();
      router.push({ pathname: "/conversation", params: { author, permlink } });
      return;
    }
    setExpanded((v) => !v);
  };

  const onRetry = () => {
    dispatch({ type: "retry", at: Date.now() });
  };

  const onDiscard = () => {
    discard();
  };

  return (
    <View style={styles.host}>
      <Pressable
        onPress={onPress}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel={pillLabel(job)}
        accessibilityHint={published ? "Opens the post" : "Shows upload details"}
      >
        <View style={styles.row}>
          <View style={styles.ringSlot}>
            <ProgressRing job={job} />
            <View style={styles.thumbSlot}>
              {uri ? (
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="play-outline" size={16} color={theme.colors.muted} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.labelBlock}>
            <View style={styles.labelRow}>
              {published ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} /> : null}
              {failed ? <Ionicons name="alert-circle" size={16} color={theme.colors.danger} /> : null}
              <Text style={[styles.label, failed && styles.labelFailed]} numberOfLines={1}>
                {pillLabel(job)}
              </Text>
            </View>
            {!expanded && isJobActive(job) ? (
              <Text style={styles.caption} numberOfLines={1}>
                {job.draft.caption || " "}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={16}
            color={theme.colors.muted}
          />
        </View>

        {expanded ? (
          <View style={styles.expanded}>
            {job.draft.caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {job.draft.caption}
              </Text>
            ) : null}
            <Text style={[styles.detail, failed && styles.detailFailed]} numberOfLines={3}>
              {pillDetail(job)}
            </Text>
            {failed ? (
              <View style={styles.actions}>
                <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
                <Pressable onPress={onDiscard} style={styles.discardButton} accessibilityRole="button">
                  <Text style={styles.discardText}>Discard</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default UploadPill;

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.layout.tabBarHeight + theme.spacing.sm,
    pointerEvents: "box-none",
  },
  pill: {
    backgroundColor: theme.colors.secondaryCard,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xxl,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: theme.spacing.sm,
  },
  ringSlot: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbSlot: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.borderRadius.full,
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBlock: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  labelFailed: {
    color: theme.colors.danger,
  },
  caption: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
  },
  expanded: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  detail: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
  },
  detailFailed: {
    color: theme.colors.danger,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  retryText: {
    color: theme.colors.black,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  discardButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  discardText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
});
