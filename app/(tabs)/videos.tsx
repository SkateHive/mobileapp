import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Share,
  useWindowDimensions,
  ViewToken,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "~/lib/auth-provider";
import { castVote, canPost } from "~/lib/posting";
import { useSoftPostOverlay } from "~/lib/userbase/soft-post-context";
import { useToast } from "~/lib/toast-provider";
import { useVideoFeed, type VideoPost } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";
import { VideoActionRail } from "~/components/ui/VideoActionRail";
import { useIsFocused } from "@react-navigation/native";
import { useVideoMuted } from "~/lib/video-mute";
import { recordVote, resolveVoteState, useVoteOverrides } from "~/lib/vote-store";
import { HIVE_AVATAR_URL } from "~/lib/constants";
import { FullConversationDrawer } from "~/components/Feed/FullConversationDrawer";
import { DollarBurst, type DollarBurstHandle } from "~/components/ui/DollarBurst";

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
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [isPlaying, setIsPlaying] = useState(false);
  const key = `${item.author}-${item.permlink}`;
  const isLiked = likedStates[key] ?? false;
  const isVoting = votingStates[key] ?? false;
  const voteCount = voteCountStates[key] ?? item.votes;
  const router = useRouter();
  // Mask the shared @skateuser account with the real (email/lite) author.
  const softOverlay = useSoftPostOverlay(item.author, item.permlink);
  const displayName = softOverlay?.handle || item.username;
  const avatarUrl = softOverlay?.avatar_url || `${HIVE_AVATAR_URL}/${displayName}/avatar`;

  // Full-screen player the user opened on purpose — sound on until they say
  // otherwise. expo-video sets the iOS session to .playback, so the ringer
  // switch doesn't silence it.
  const [isMuted, setMuted] = useVideoMuted(false);

  // Native video player — fast, no WebView
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // Play/pause based on visibility. Focus matters too: this tab stays mounted
  // when you leave it, and a clip that keeps playing carries its sound into
  // whatever screen you moved to.
  const isFocused = useIsFocused();
  // Hold to pause, release to resume — same gesture as the immersive viewer.
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (isActive && isFocused && !holding) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isFocused, holding, player]);

  // Track when video actually starts playing — depends only on player to avoid duplicate subscriptions
  useEffect(() => {
    const sub = player.addListener("playingChange", (e: { isPlaying: boolean }) => {
      if (e.isPlaying) setIsPlaying(true);
    });
    return () => sub?.remove();
  }, [player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, [player]);

  const formatPayout = (payout: string) => {
    const value = parseFloat(payout) || 0;
    return value > 0 ? `$${value.toFixed(2)}` : "";
  };

  // ── Double-tap to vote ($-sign confetti burst) ────────────────────────────
  const canVote = !!username && username !== "SPECTATOR";
  const lastTap = useRef(0);
  const burstRef = useRef<DollarBurstHandle>(null);

  const handleVideoTap = useCallback((e: GestureResponderEvent) => {
    const now = Date.now();
    const { locationX, locationY } = e.nativeEvent;
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (!canVote) {
        // Not logged in — let onVote surface the login prompt, skip the burst.
        onVote(item);
        return;
      }
      // The burst celebrates a vote, so it only fires when one happens. On an
      // already-voted post it was still playing and promising a vote that
      // never came.
      if (isLiked) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      burstRef.current?.play(locationX, locationY);
      onVote(item);
    } else {
      lastTap.current = now;
    }
  }, [canVote, isLiked, onVote, item]);

  return (
    <View style={[styles.videoContainer, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
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

      {/* Double-tap-to-vote layer — sits over the video, under the action
          buttons/overlays (which are later siblings, so they keep their taps). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleVideoTap}
        onLongPress={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        // See the viewer: below ~500ms this eats the first tap of a double-tap
        // vote.
        delayLongPress={500}
      />

      {/* "$" money burst at the tap point */}
      <DollarBurst ref={burstRef} />

      {/* Top: user info */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.userInfo}
          onPress={() => router.push(`/(tabs)/profile?username=${item.username}`)}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} transition={0} />
          <Text style={styles.username}>@{displayName}</Text>
          {formatPayout(item.payout) ? (
            <Text style={styles.balance}> +{formatPayout(item.payout)}</Text>
          ) : null}
        </Pressable>
      </View>

      {/* Bottom: title */}
      {item.title ? (
        <View style={styles.bottomOverlay}>
          <Text style={styles.titleText} numberOfLines={2}>{item.title}</Text>
        </View>
      ) : null}

      <VideoActionRail
        isLiked={isLiked}
        voteCount={voteCount}
        isVoting={isVoting}
        commentCount={item.replies ?? 0}
        // Undefined once voted: the rail then renders the count without a
        // button, the same shape it uses for your own posts.
        onVote={isLiked ? undefined : () => onVote(item)}
        onComment={() => onComment(item)}
        onShare={() => onShare(item)}
        isMuted={isMuted}
        onToggleMute={() => setMuted(!isMuted)}
        bottom={200}
      />
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function VideosScreen() {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const router = useRouter();
  const { session, username } = useAuth();
  const { showToast } = useToast();
  const { data: videos = [], isLoading, refetch, isRefetching } = useVideoFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const votingLockRef = useRef<Record<string, boolean>>({});
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<Record<string, number>>({});
  const [conversationVideo, setConversationVideo] = useState<VideoPost | null>(null);

  const voteOverrides = useVoteOverrides();

  // Init liked/vote states when data arrives. This feed is prefetched at login
  // and cached for a minute, so on its own it happily shows an empty heart for
  // a post voted on elsewhere — hence the session's votes on top (#48).
  useEffect(() => {
    if (videos.length === 0) return;
    const liked: Record<string, boolean> = {};
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      const key = `${v.author}-${v.permlink}`;
      const state = resolveVoteState(voteOverrides, v, username, v.votes);
      liked[key] = state.isLiked;
      counts[key] = state.voteCount;
    });
    setLikedStates(liked);
    setVoteCountStates(counts);
  }, [videos, username, voteOverrides]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // Where the scroll actually stopped, which viewability alone doesn't tell us:
  // fling past two or three videos and viewableItems[0] can be a clip you flew
  // over, with no further event once things settle — so the video on screen
  // never gets play() and sits there frozen. The offset is unambiguous.
  const settleOnIndex = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
      setCurrentIndex(Math.max(0, Math.min(videos.length - 1, index)));
    },
    [SCREEN_HEIGHT, videos.length]
  );

  const handleVote = useCallback(async (video: VideoPost) => {
    const key = `${video.author}-${video.permlink}`;
    if (!canPost(session)) {
      showToast("Please login first", "error");
      return;
    }
    // Use ref for immediate synchronous lock — prevents double-tap race before state update lands
    if (votingLockRef.current[key]) return;
    votingLockRef.current[key] = true;

    const wasLiked = likedStates[key];
    const prevCount = voteCountStates[key] || video.votes;
    // A vote is final: tapping an already-voted heart used to cast weight 0 and
    // quietly take it back, which is not what "vote again" looks like.
    if (wasLiked) {
      votingLockRef.current[key] = false;
      return;
    }

    try {
      setVotingStates((p) => ({ ...p, [key]: true }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLikedStates((p) => ({ ...p, [key]: true }));
      setVoteCountStates((p) => ({ ...p, [key]: prevCount + 1 }));

      await castVote(session!, video.author, video.permlink, 10000);
      recordVote(video.author, video.permlink, 10000);
      // No success toast — the $-confetti + heart fill are enough feedback.
    } catch (error) {
      setLikedStates((p) => ({ ...p, [key]: wasLiked }));
      setVoteCountStates((p) => ({ ...p, [key]: prevCount }));
      showToast(error instanceof Error ? error.message : "Failed to vote", "error");
    } finally {
      votingLockRef.current[key] = false;
      setVotingStates((p) => ({ ...p, [key]: false }));
    }
  }, [session, votingStates, likedStates, voteCountStates, showToast]);

  const handleComment = useCallback((video: VideoPost) => {
    setConversationVideo(video);
  }, []);

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
      {/* Feed shortcut — top-right corner */}
      <Pressable
        style={styles.feedButton}
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/(tabs)/feed");
        }}
        accessibilityRole="button"
        accessibilityLabel="Open feed"
        hitSlop={8}
      >
        <Ionicons name="reader-outline" size={24} color="#fff" />
      </Pressable>

      {videos.length > 0 ? (
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.author}-${item.permlink}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                refetch();
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          snapToAlignment="start"
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Both: a flick ends in momentum, a slow drag ends without it.
          onMomentumScrollEnd={settleOnIndex}
          onScrollEndDrag={settleOnIndex}
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

      {conversationVideo && (
        <FullConversationDrawer
          visible={!!conversationVideo}
          onClose={() => setConversationVideo(null)}
          author={conversationVideo.author}
          permlink={conversationVideo.permlink}
          partial
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  feedButton: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  // videoContainer dimensions are set inline via useWindowDimensions in VideoItem
  videoContainer: { backgroundColor: "#000" },
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
  // Post earnings, inline with the @username: same size/weight, just green + "+".
  balance: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: "700",
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
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  emptyText: { color: theme.colors.gray, fontSize: 16 },
});
