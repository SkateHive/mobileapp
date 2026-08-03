import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";

const VOTE_ICON = 28;
const ACTION_ICON = 26;

interface VideoActionRailProps {
  isLiked: boolean;
  voteCount: number;
  isVoting?: boolean;
  commentCount: number;
  /** Omitted on your own posts — you can't self-vote, so the count is read-only. */
  onVote?: () => void;
  onComment: () => void;
  onShare: () => void;
  /** "Save to camera roll", offered on your own posts in the profile viewer. */
  onDownload?: () => void;
  isDownloading?: boolean;
  /** Screens clear different amounts of chrome below the rail. */
  bottom?: number;
}

/**
 * The comment / vote / share column shared by the Videos tab and the immersive
 * viewer.
 *
 * It exists as one component because it used to be two copies, which drifted into
 * different icon sizes on opposite sides of the screen (#33). Earnings live beside
 * the @username on both screens, not in here.
 */
export function VideoActionRail({
  isLiked,
  voteCount,
  isVoting = false,
  commentCount,
  onVote,
  onComment,
  onShare,
  onDownload,
  isDownloading = false,
  bottom = 96,
}: VideoActionRailProps) {
  const voteBody = (
    <>
      {isVoting ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Ionicons
          name={isLiked ? "heart" : "heart-outline"}
          size={VOTE_ICON}
          color={isLiked ? theme.colors.primary : theme.colors.white}
        />
      )}
      {voteCount > 0 && (
        <Text style={[styles.count, isLiked && { color: theme.colors.primary }]}>
          {voteCount}
        </Text>
      )}
    </>
  );

  return (
    <View style={[styles.rail, { bottom }]}>
      {onDownload && (
        <Pressable
          style={styles.action}
          onPress={onDownload}
          disabled={isDownloading}
          accessibilityRole="button"
          accessibilityLabel="Save to camera roll"
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="download-outline" size={ACTION_ICON} color={theme.colors.white} />
          )}
        </Pressable>
      )}

      {onVote ? (
        <Pressable
          style={styles.action}
          onPress={onVote}
          disabled={isVoting}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? `Voted, ${voteCount} votes` : `Upvote, ${voteCount} votes`}
          accessibilityState={{ selected: isLiked, disabled: isVoting }}
        >
          {voteBody}
        </Pressable>
      ) : (
        // Your own post: the count still matters, the button doesn't.
        <View style={styles.action} accessible accessibilityLabel={`${voteCount} votes`}>
          {voteBody}
        </View>
      )}

      <Pressable
        style={styles.action}
        onPress={onComment}
        accessibilityRole="button"
        accessibilityLabel={`${commentCount} replies`}
      >
        <Ionicons name="chatbubble-outline" size={ACTION_ICON} color={theme.colors.white} />
        {commentCount > 0 && <Text style={styles.count}>{commentCount}</Text>}
      </Pressable>

      <Pressable
        style={styles.action}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share"
      >
        <Ionicons name="share-outline" size={ACTION_ICON} color={theme.colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    right: theme.spacing.md,
    alignItems: "center",
    gap: 20,
    zIndex: 10,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  count: {
    color: theme.colors.white,
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
