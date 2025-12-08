import React, { useState, useRef, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { useAuth } from "~/lib/auth-provider";
import { getFeed } from "~/lib/api";
import { extractMediaFromBody } from "~/lib/utils";
import { vote as hiveVote } from "~/lib/hive-utils";
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import type { Post } from "~/lib/types";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface VideoPost {
  videoUrl: string;
  username: string;
  permlink: string;
  author: string;
  // Extended data from the original post
  title: string;
  body: string;
  created: string;
  votes: number;
  payout: string;
  replies: number;
  thumbnailUrl?: string;
  tags: string[];
  json_metadata: any;
  active_votes: any[];
}

export default function VideosScreen() {
  const router = useRouter();
  const { session, username } = useAuth();
  const { showToast } = useToast();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<Record<string, number>>({});
  const flatListRef = useRef<FlatList>(null);

  const loadVideos = async () => {
    try {
      setIsLoading(true);
      const posts = await getFeed(1, 50);

      const videoList: VideoPost[] = [];

      posts.forEach((post: Post) => {
        const media = extractMediaFromBody(post.body);
        const videoMedia = media.filter((m) => m.type === "video");

        // Cast to any to access all HIVE blockchain fields
        const rawPost = post as any;

        if (videoMedia.length > 0) {
          // Parse json_metadata
          let metadata: any = {};
          try {
            metadata =
              typeof rawPost.json_metadata === "string"
                ? JSON.parse(rawPost.json_metadata)
                : rawPost.json_metadata;
          } catch (e) {
            metadata = {};
          }

          const imageMedia = media.filter((m) => m.type === "image");

          videoMedia.forEach((video) => {
            // Find thumbnail - prefer metadata image, then first image in post
            const thumbnail = metadata?.image?.[0] || imageMedia[0]?.url;

            videoList.push({
              videoUrl: video.url,
              username: post.author,
              permlink: post.permlink,
              author: post.author,
              title: post.title || "",
              body: post.body || "",
              created: post.created || "",
              votes: rawPost.net_votes || 0,
              payout:
                rawPost.pending_payout_value ||
                rawPost.total_payout_value ||
                "0.000 HBD",
              replies: rawPost.children || 0,
              thumbnailUrl: thumbnail,
              tags: metadata?.tags || [],
              json_metadata: metadata,
              active_votes: rawPost.active_votes || [],
            });
          });
        }
      });

      setVideos(videoList);
      
      // Initialize liked and vote count states based on active_votes
      const initialLiked: Record<string, boolean> = {};
      const initialVoteCounts: Record<string, number> = {};
      videoList.forEach((video) => {
        const key = `${video.author}-${video.permlink}`;
        const hasVoted = username && video.active_votes?.some(
          (v: any) => v.voter === username && v.weight > 0
        );
        initialLiked[key] = !!hasVoted;
        initialVoteCounts[key] = video.votes;
      });
      setLikedStates(initialLiked);
      setVoteCountStates(initialVoteCounts);
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh videos when tab comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadVideos();
      setCurrentIndex(0);
    }, [])
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Handle vote on a video
  const handleVote = useCallback(async (video: VideoPost) => {
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
        [key]: isCurrentlyLiked ? previousVoteCount - 1 : previousVoteCount + 1,
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
  }, [session, votingStates, likedStates, voteCountStates, showToast]);

  // Handle comment button - navigate to conversation
  const handleComment = useCallback((video: VideoPost) => {
    router.push({
      pathname: "/conversation",
      params: {
        author: video.author,
        permlink: video.permlink,
      },
    });
  }, [router]);

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

    return (
      <View style={styles.videoContainer}>
        <VideoPlayer
          url={item.videoUrl}
          playing={isActive}
          contentFit="cover"
          showControls={false}
        />

        {/* Top header with user info */}
        <View style={styles.topHeader}>
          <Pressable style={styles.userInfo} onPress={handleUserPress}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
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
              <Text style={[styles.actionText, isLiked && { color: theme.colors.primary }]}>
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
              <Ionicons name="cash-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.payoutTextLarge}>{formatPayout(item.payout)}</Text>
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
