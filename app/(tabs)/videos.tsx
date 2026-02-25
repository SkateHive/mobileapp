import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Text,
  ActivityIndicator,
  Image,
  Pressable,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { useAuth } from "~/lib/auth-provider";
import { vote as hiveVote } from "~/lib/hive-utils";
import { useToast } from "~/lib/toast-provider";
import { useVideoFeed, type VideoPost } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export default function VideosScreen() {
  const router = useRouter();
  const { session, username } = useAuth();
  const { showToast } = useToast();
  const { data: videos = [], isLoading } = useVideoFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<
    Record<string, number>
  >({});
  const [playingStates, setPlayingStates] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  // Initialize liked and vote count states when videos load
  useEffect(() => {
    if (videos.length === 0) return;
    const initialLiked: Record<string, boolean> = {};
    const initialVoteCounts: Record<string, number> = {};
    videos.forEach((video) => {
      const key = `${video.author}-${video.permlink}`;
      const hasVoted =
        username &&
        video.active_votes?.some(
          (v: any) => v.voter === username && v.weight > 0
        );
      initialLiked[key] = !!hasVoted;
      initialVoteCounts[key] = video.votes;
    });
    setLikedStates(initialLiked);
    setVoteCountStates(initialVoteCounts);
  }, [videos, username]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Handle vote on a video
  const handleVote = useCallback(
    async (video: VideoPost) => {
      const key = `${video.author}-${video.permlink}`;

      if (!session || !session.username || !session.decryptedKey) {
        showToast("Please login first", "error");
        return;
      }

      if (session.username === "SPECTATOR") {
        showToast("Please login first", "error");
        return;
      }

      // Prevent double-tapping
      if (votingStates[key]) return;

      try {
        setVotingStates((prev) => ({ ...prev, [key]: true }));

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const isCurrentlyLiked = likedStates[key];
        const previousVoteCount = voteCountStates[key] || video.votes;

        // Optimistic update
        setLikedStates((prev) => ({ ...prev, [key]: !isCurrentlyLiked }));
        setVoteCountStates((prev) => ({
          ...prev,
          [key]: isCurrentlyLiked
            ? previousVoteCount - 1
            : previousVoteCount + 1,
        }));

        // Submit vote to blockchain (100% weight for like, 0 for unlike)
        await hiveVote(
          session.decryptedKey,
          session.username,
          video.author,
          video.permlink,
          isCurrentlyLiked ? 0 : 10000 // 10000 = 100%
        );

        showToast(isCurrentlyLiked ? "Vote removed" : "Voted!", "success");
      } catch (error) {
        // Revert optimistic update on error
        const isCurrentlyLiked = likedStates[key];
        setLikedStates((prev) => ({ ...prev, [key]: !isCurrentlyLiked }));
        setVoteCountStates((prev) => ({
          ...prev,
          [key]: voteCountStates[key] || video.votes,
        }));

        let errorMessage = "Failed to vote";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        showToast(errorMessage, "error");
      } finally {
        setVotingStates((prev) => ({ ...prev, [key]: false }));
      }
    },
    [session, votingStates, likedStates, voteCountStates, showToast]
  );

  // Handle comment button - navigate to conversation
  const handleComment = useCallback(
    (video: VideoPost) => {
      router.push({
        pathname: "/conversation",
        params: {
          author: video.author,
          permlink: video.permlink,
        },
      });
    },
    [router]
  );

  // Handle share button
  const handleShare = useCallback(async (video: VideoPost) => {
    try {
      const url = `https://skatehive.app/@${video.author}/${video.permlink}`;
      await Share.share({
        message: video.title
          ? `${video.title}\n\n${url}`
          : `Check out this video by @${video.author}\n\n${url}`,
        url: url,
      });
    } catch (error) {
      // User cancelled or error
    }
  }, []);

  const renderVideo = ({ item, index }: { item: VideoPost; index: number }) => {
    const isActive = index === currentIndex;
    const isNearby = Math.abs(index - currentIndex) <= 1;
    const avatarUrl = `https://images.hive.blog/u/${item.username}/avatar`;
    const key = `${item.author}-${item.permlink}`;
    const isLiked = likedStates[key] ?? false;
    const isVoting = votingStates[key] ?? false;
    const voteCount = voteCountStates[key] ?? item.votes;

    // Format payout value
    const formatPayout = (payout: string) => {
      const value = parseFloat(payout) || 0;
      return value > 0 ? `$${value.toFixed(2)}` : "";
    };

    const handleUserPress = () => {
      router.push(`/(tabs)/profile?username=${item.username}`);
    };

    const isVideoPlaying = playingStates[key] ?? false;

    return (
      <View style={styles.videoContainer}>
        {/* Thumbnail shown behind video — visible while video buffers */}
        {item.thumbnailUrl && (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
            fadeDuration={0}
          />
        )}

        {/* Only mount VideoPlayer for current and adjacent items */}
        {isNearby ? (
          <VideoPlayer
            url={item.videoUrl}
            playing={isActive}
            contentFit="cover"
            showControls={false}
            onPlaybackStarted={() => {
              setPlayingStates((prev) => ({ ...prev, [key]: true }));
            }}
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            {!item.thumbnailUrl && (
              <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.5)" />
            )}
          </View>
        )}

        {/* Loading indicator — only while video is actively buffering */}
        {isActive && !isVideoPlaying && (
          <View style={styles.bufferingIndicator}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {/* Top header with user info */}
        <View style={styles.topHeader}>
          <Pressable style={styles.userInfo} onPress={handleUserPress}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} fadeDuration={0} />
            <Text style={styles.username}>@{item.username}</Text>
          </Pressable>

          <View style={styles.headerSpacer} />
        </View>

        {/* Bottom info overlay */}
        <View style={styles.bottomOverlay}>
          {/* Title if available */}
          {item.title ? (
            <Text style={styles.titleText} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <Text style={styles.tagsText} numberOfLines={1}>
              #{item.tags.slice(0, 3).join(" #")}
            </Text>
          )}
        </View>

        {/* Left side action buttons */}
        <View style={styles.leftActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleVote(item)}
            disabled={isVoting}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={28}
                color={isLiked ? theme.colors.primary : "#fff"}
              />
            )}
            {voteCount > 0 && (
              <Text
                style={[
                  styles.actionText,
                  isLiked && { color: theme.colors.primary },
                ]}
              >
                {voteCount}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => handleComment(item)}
          >
            <Ionicons name="chatbubble-outline" size={26} color="#fff" />
            {item.replies > 0 && (
              <Text style={styles.actionText}>{item.replies}</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <Ionicons name="share-outline" size={26} color="#fff" />
          </Pressable>

          {formatPayout(item.payout) ? (
            <View style={styles.payoutContainer}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.payoutTextLarge}>
                {formatPayout(item.payout)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {videos.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={renderVideo}
          keyExtractor={(item, index) => `${item.permlink}-${index}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          windowSize={3}
          initialNumToRender={1}
          initialScrollIndex={0}
          getItemLayout={(data, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="videocam-off-outline"
            size={64}
            color={theme.colors.gray}
          />
          <Text style={styles.emptyText}>No videos found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  bufferingIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -10,
    marginLeft: -10,
    zIndex: 1,
  },
  // Top header styles
  topHeader: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  username: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 10,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSpacer: {
    width: 40,
  },
  // Bottom overlay styles
  bottomOverlay: {
    position: "absolute",
    bottom: 120,
    left: 16,
    right: 80,
  },
  titleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 6,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payoutText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  payoutContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  payoutTextLarge: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  statText: {
    color: "#fff",
    fontSize: 13,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagsText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Left side action buttons
  leftActions: {
    position: "absolute",
    left: 16,
    bottom: 200,
    alignItems: "center",
    gap: 20,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#fff",
    marginBottom: 4,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    color: theme.colors.gray,
    fontSize: 16,
  },
});
