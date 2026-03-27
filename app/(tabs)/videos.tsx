import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Text,
  ActivityIndicator,
  Pressable,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "~/lib/auth-provider";
import { vote as hiveVote } from "~/lib/hive-utils";
import { useToast } from "~/lib/toast-provider";
import { useVideoFeed, type VideoPost } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Native video item ─────────────────────────────────────────────────────
// Each item gets its own expo-video player — no WebView overhead.

function VideoItem({
  item,
  isActive,
  username,
  onVote,
  onComment,
  onShare,
  votingStates,
  likedStates,
  voteCountStates,
}: {
  item: VideoPost;
  isActive: boolean;
  username: string | null;
  onVote: (v: VideoPost) => void;
  onComment: (v: VideoPost) => void;
  onShare: (v: VideoPost) => void;
  votingStates: Record<string, boolean>;
  likedStates: Record<string, boolean>;
  voteCountStates: Record<string, number>;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const key = `${item.author}-${item.permlink}`;
  const isLiked = likedStates[key] ?? false;
  const isVoting = votingStates[key] ?? false;
  const voteCount = voteCountStates[key] ?? item.votes;
  const router = useRouter();
  const avatarUrl = `https://images.hive.blog/u/${item.username}/avatar`;

  // Native video player — fast, no WebView
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Play/pause based on visibility
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Track when video actually starts playing
  useEffect(() => {
    const sub = player.addListener("playingChange", (e: { isPlaying: boolean }) => {
      if (e.isPlaying && !isPlaying) setIsPlaying(true);
    });
    return () => sub?.remove();
  }, [player, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, [player]);

  const formatPayout = (payout: string) => {
    const value = parseFloat(payout) || 0;
    return value > 0 ? `$${value.toFixed(2)}` : "";
  };

  return (
    <View style={styles.videoContainer}>
      {/* Native video — renders underneath thumbnail */}
      <VideoView
        style={styles.nativeVideo}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Thumbnail poster — covers video until it plays */}
      {!isPlaying && item.thumbnailUrl && (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={0}
        />
      )}

      {/* Minimal spinner when no thumbnail and not playing yet */}
      {!isPlaying && !item.thumbnailUrl && (
        <View style={styles.spinnerOverlay}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
        </View>
      )}

      {/* Top: user info */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.userInfo}
          onPress={() => router.push(`/(tabs)/profile?username=${item.username}`)}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} transition={0} />
          <Text style={styles.username}>@{item.username}</Text>
        </Pressable>
      </View>

      {/* Bottom: title + tags */}
      <View style={styles.bottomOverlay}>
        {item.title ? (
          <Text style={styles.titleText} numberOfLines={2}>{item.title}</Text>
        ) : null}
        {item.tags?.length > 0 && (
          <Text style={styles.tagsText} numberOfLines={1}>
            #{item.tags.slice(0, 3).join(" #")}
          </Text>
        )}
      </View>

      {/* Left: action buttons */}
      <View style={styles.leftActions}>
        <Pressable style={styles.actionButton} onPress={() => onVote(item)} disabled={isVoting}>
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

        <Pressable style={styles.actionButton} onPress={() => onComment(item)}>
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          {item.replies > 0 && <Text style={styles.actionText}>{item.replies}</Text>}
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onShare(item)}>
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
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function VideosScreen() {
  const router = useRouter();
  const { session, username } = useAuth();
  const { showToast } = useToast();
  const { data: videos = [], isLoading } = useVideoFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<Record<string, number>>({});

  // Init liked/vote states when data arrives
  useEffect(() => {
    if (videos.length === 0) return;
    const liked: Record<string, boolean> = {};
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      const key = `${v.author}-${v.permlink}`;
      liked[key] = !!(username && v.active_votes?.some((vote) => vote.voter === username && vote.weight > 0));
      counts[key] = v.votes;
    });
    setLikedStates(liked);
    setVoteCountStates(counts);
  }, [videos, username]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index || 0);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleVote = useCallback(async (video: VideoPost) => {
    const key = `${video.author}-${video.permlink}`;
    if (!session?.username || session.username === "SPECTATOR" || !session?.decryptedKey) {
      showToast("Please login first", "error");
      return;
    }
    if (votingStates[key]) return;

    const wasLiked = likedStates[key];
    const prevCount = voteCountStates[key] || video.votes;

    try {
      setVotingStates((p) => ({ ...p, [key]: true }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLikedStates((p) => ({ ...p, [key]: !wasLiked }));
      setVoteCountStates((p) => ({ ...p, [key]: wasLiked ? prevCount - 1 : prevCount + 1 }));

      await hiveVote(session.decryptedKey, session.username, video.author, video.permlink, wasLiked ? 0 : 10000);
      showToast(wasLiked ? "Vote removed" : "Voted!", "success");
    } catch (error) {
      setLikedStates((p) => ({ ...p, [key]: wasLiked }));
      setVoteCountStates((p) => ({ ...p, [key]: prevCount }));
      showToast(error instanceof Error ? error.message : "Failed to vote", "error");
    } finally {
      setVotingStates((p) => ({ ...p, [key]: false }));
    }
  }, [session, votingStates, likedStates, voteCountStates, showToast]);

  const handleComment = useCallback((video: VideoPost) => {
    router.push({ pathname: "/conversation", params: { author: video.author, permlink: video.permlink } });
  }, [router]);

  const handleShare = useCallback(async (video: VideoPost) => {
    try {
      const url = `https://skatehive.app/@${video.author}/${video.permlink}`;
      await Share.share({
        message: video.title ? `${video.title}\n\n${url}` : `Check out this video by @${video.author}\n\n${url}`,
        url,
      });
    } catch {}
  }, []);

  const renderItem = useCallback(({ item, index }: { item: VideoPost; index: number }) => (
    <VideoItem
      item={item}
      isActive={index === currentIndex}
      username={username}
      onVote={handleVote}
      onComment={handleComment}
      onShare={handleShare}
      votingStates={votingStates}
      likedStates={likedStates}
      voteCountStates={voteCountStates}
    />
  ), [currentIndex, username, handleVote, handleComment, handleShare, votingStates, likedStates, voteCountStates]);

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
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item, i) => `${item.permlink}-${i}`}
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
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={64} color={theme.colors.gray} />
          <Text style={styles.emptyText}>No videos found</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#000" },
  nativeVideo: { ...StyleSheet.absoluteFillObject },
  thumbnail: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
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
  userInfo: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12 },
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
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: { position: "absolute", bottom: 120, left: 16, right: 80, zIndex: 10 },
  titleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagsText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  leftActions: {
    position: "absolute",
    left: 16,
    bottom: 200,
    alignItems: "center",
    gap: 20,
    zIndex: 10,
  },
  actionButton: { alignItems: "center", justifyContent: "center" },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  payoutContainer: { alignItems: "center", justifyContent: "center", marginTop: 4 },
  payoutTextLarge: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  emptyText: { color: theme.colors.gray, fontSize: 16 },
});
