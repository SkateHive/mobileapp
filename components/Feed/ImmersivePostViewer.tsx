import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  useWindowDimensions,
  type GestureResponderEvent,
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { castVote, canPost } from "~/lib/posting";
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import { HIVE_AVATAR_URL } from "~/lib/constants";
import { extractMediaFromBody, formatPayout, metadataImageUrl } from "~/lib/utils";
import { DollarBurst, type DollarBurstHandle } from "~/components/ui/DollarBurst";
import { VideoActionRail } from "~/components/ui/VideoActionRail";
import { useVideoMuted } from "~/lib/video-mute";
import { recordVote, resolveVoteState, useVoteOverrides } from "~/lib/vote-store";
import { FullConversationDrawer } from "~/components/Feed/FullConversationDrawer";

const postKey = (p: any) => `${p.author}/${p.permlink}`;

/** Resolve the media to show: prefer a direct video, else the image set. */
function usePostMedia(post: any) {
  return useMemo(() => {
    const media = extractMediaFromBody(post?.body || "");
    const video = media.find((m) => m.type === "video");
    let metaImage: string | null = null;
    try {
      const meta =
        typeof post?.json_metadata === "string"
          ? JSON.parse(post.json_metadata)
          : post?.json_metadata || {};
      metaImage = metadataImageUrl(meta);
    } catch {}
    const bodyImages = media.filter((m) => m.type === "image").map((m) => m.url);
    const images = Array.from(
      new Set([...bodyImages, ...(metaImage ? [metaImage] : [])])
    );
    // A video snap has no markdown image, so its poster only ever comes from
    // json_metadata — the frame the transcoder extracted.
    const poster = video ? metaImage ?? bodyImages[0] : images[0];
    return { videoUrl: video?.url, images, poster };
  }, [post?.body, post?.json_metadata]);
}

/** Strip markdown media/markup for a short caption fallback. */
function captionFor(post: any): string {
  const title = String(post?.title || "").trim();
  // Snaps carry an auto-generated "RE: Snaps Container // <date>" title that's
  // noise — fall back to the body for those (and for titleless posts).
  const isAutoTitle = !title || /^RE:/i.test(title) || /snaps?\s*container/i.test(title);
  if (!isAutoTitle) return title;
  const body = String(post?.body || "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#>*_`~]/g, "")
    .trim();
  return body.slice(0, 1500);
}

// ─── One full-screen post ─────────────────────────────────────────────────────
interface ItemProps {
  post: any;
  isActive: boolean;
  width: number;
  height: number;
  isLiked: boolean;
  voteCount: number;
  isVoting: boolean;
  canVote: boolean;
  isOwn: boolean;
  onVote: (post: any) => void;
  onComment: (post: any) => void;
  onShare: (post: any) => void;
  onClose: () => void;
  onOpenProfile: (author: string) => void;
  onToast: (msg: string, type?: "success" | "error") => void;
}

function ImmersivePostItem({
  post,
  isActive,
  width,
  height,
  isLiked,
  voteCount,
  isVoting,
  canVote,
  isOwn,
  onVote,
  onComment,
  onShare,
  onClose,
  onOpenProfile,
  onToast,
}: ItemProps) {
  const { videoUrl, images, poster } = usePostMedia(post);
  const [imageIndex, setImageIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const lastTap = useRef(0);
  const burstRef = useRef<DollarBurstHandle>(null);
  const caption = captionFor(post);
  const payout = formatPayout(post);
  const avatarUrl = `${HIVE_AVATAR_URL}/${post.author}/avatar`;

  // Same deal as the Videos tab: a full-screen player starts with sound.
  const [isMuted, setMuted] = useVideoMuted(false);

  // expo-video player is created unconditionally (hooks rule); idle when no video.
  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!videoUrl) return;
    if (isActive) player.play();
    else player.pause();
  }, [isActive, videoUrl, player]);

  // The poster stays up until the surface actually renders a frame — the gateway
  // needs a second or two, and hiding it earlier just shows black. Playback state
  // isn't the same signal: the player reports playing before anything is drawn.
  const [hasFrames, setHasFrames] = useState(false);
  useEffect(() => {
    setHasFrames(false);
  }, [videoUrl]);

  // Collapse the caption when this post scrolls away, so it re-opens clean and
  // its expanded scroll-view never fights the vertical paging gesture.
  useEffect(() => {
    if (!isActive) setCaptionExpanded(false);
  }, [isActive]);

  const handleTap = useCallback(
    (e: GestureResponderEvent) => {
      const now = Date.now();
      const { locationX, locationY } = e.nativeEvent;
      if (now - lastTap.current < 280) {
        lastTap.current = 0;
        if (isOwn) return; // your own post — no self-vote on double-tap
        if (!canVote) {
          onVote(post); // surfaces the login prompt
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        burstRef.current?.play(locationX, locationY);
        if (!isLiked) onVote(post); // double-tap only ever likes
      } else {
        lastTap.current = now;
      }
    },
    [canVote, isLiked, isOwn, onVote, post]
  );

  // Save the post's media (video or current image) to the camera roll.
  const handleDownload = useCallback(async () => {
    if (downloading) return;
    const url = videoUrl || images[imageIndex] || images[0];
    if (!url) {
      onToast("Nothing to download", "error");
      return;
    }
    try {
      setDownloading(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        onToast("Allow photo access to save", "error");
        return;
      }
      const clean = url.split("?")[0];
      const ext = videoUrl
        ? "mp4"
        : clean.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1] || "jpg";
      const dest = new File(Paths.cache, `skatehive-${post.permlink}.${ext}`);
      if (dest.exists) dest.delete();
      const file = await File.downloadFileAsync(url, dest);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onToast("Saved to camera roll", "success");
    } catch {
      onToast("Download failed", "error");
    } finally {
      setDownloading(false);
    }
  }, [downloading, videoUrl, images, imageIndex, post.permlink, onToast]);

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      {/* Media */}
      {videoUrl ? (
        <>
          {/* Fills the screen like the Videos tab — one full-screen behaviour
              across both players (#33). Crops non-vertical clips at the edges. */}
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            contentFit="cover"
            nativeControls={false}
            onFirstFrameRender={() => setHasFrames(true)}
          />
          {/* Matches the video's fit, so there's no jump from a letterboxed
              poster to full-bleed video. */}
          {poster && (!isActive || !hasFrames) && (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          )}
          <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
        </>
      ) : images.length > 0 ? (
        <FlatList
          style={{ width, height }}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item: uri }) => (
            <Pressable onPress={handleTap} style={[styles.center, { width, height }]}>
              <Image
                source={{ uri }}
                style={{ width, height }}
                contentFit="contain"
                transition={0}
              />
            </Pressable>
          )}
        />
      ) : (
        <Pressable style={[StyleSheet.absoluteFill, styles.center]} onPress={handleTap}>
          <Ionicons name="image-outline" size={64} color={theme.colors.muted} />
        </Pressable>
      )}

      {/* "$" burst on top of media */}
      <DollarBurst ref={burstRef} />

      {/* Top bar: author + close */}
      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <Pressable style={styles.author} onPress={() => onOpenProfile(post.author)} hitSlop={8}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} transition={0} />
          <Text style={styles.username}>@{post.author}</Text>
          {payout ? <Text style={styles.balance}> +{payout}</Text> : null}
        </Pressable>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </SafeAreaView>

      {/* Image carousel dots */}
      {!videoUrl && images.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === imageIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Caption — tap to expand/collapse (Instagram-style) */}
      {caption ? (
        <Pressable
          style={[styles.caption, captionExpanded && styles.captionExpanded]}
          onPress={() => setCaptionExpanded((e) => !e)}
        >
          {captionExpanded ? (
            <ScrollView
              style={{ maxHeight: height * 0.42 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={styles.captionText}>{caption}</Text>
              <Text style={styles.captionToggle}>less</Text>
            </ScrollView>
          ) : (
            <>
              <Text style={styles.captionText} numberOfLines={2}>
                {caption}
              </Text>
              {(caption.length > 80 || caption.includes("\n")) && (
                <Text style={styles.captionToggle}>… more</Text>
              )}
            </>
          )}
        </Pressable>
      ) : null}

      <VideoActionRail
        isLiked={isLiked}
        voteCount={voteCount}
        isVoting={isVoting}
        commentCount={post.children ?? 0}
        onVote={isOwn ? undefined : () => onVote(post)}
        onComment={() => onComment(post)}
        onShare={() => onShare(post)}
        onDownload={isOwn ? handleDownload : undefined}
        isDownloading={downloading}
        isMuted={isMuted}
        onToggleMute={videoUrl ? () => setMuted(!isMuted) : undefined}
      />
    </View>
  );
}

// ─── The viewer (full-screen modal over the profile) ──────────────────────────
interface ViewerProps {
  visible: boolean;
  posts: any[];
  initialIndex: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}

export function ImmersivePostViewer({
  visible,
  posts,
  initialIndex,
  hasMore,
  onLoadMore,
  onClose,
}: ViewerProps) {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { username, session } = useAuth();
  const { showToast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<Record<string, number>>({});
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const votingLockRef = useRef<Record<string, boolean>>({});
  const [conversationPost, setConversationPost] = useState<any | null>(null);

  const canVote = !!username && username !== "SPECTATOR";

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  const voteOverrides = useVoteOverrides();

  // Seed liked/vote-count state from the posts' on-chain votes, corrected by
  // this session's votes — the profile query these posts come from is its own
  // snapshot and lags a vote cast on another screen (#48).
  useEffect(() => {
    const liked: Record<string, boolean> = {};
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      const key = postKey(p);
      const state = resolveVoteState(voteOverrides, p, username, p.net_votes ?? 0);
      liked[key] = state.isLiked;
      counts[key] = state.voteCount;
    });
    setLikedStates(liked);
    setVoteCountStates(counts);
  }, [posts, username, voteOverrides]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
    }
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleVote = useCallback(
    async (post: any) => {
      const key = postKey(post);
      if (!canPost(session)) {
        showToast("Please login first", "error");
        return;
      }
      if (votingLockRef.current[key]) return;
      votingLockRef.current[key] = true;

      const wasLiked = likedStates[key];
      const prevCount = voteCountStates[key] ?? 0;
      try {
        setVotingStates((p) => ({ ...p, [key]: true }));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLikedStates((p) => ({ ...p, [key]: !wasLiked }));
        setVoteCountStates((p) => ({ ...p, [key]: wasLiked ? prevCount - 1 : prevCount + 1 }));
        await castVote(session!, post.author, post.permlink, wasLiked ? 0 : 10000);
        recordVote(post.author, post.permlink, wasLiked ? 0 : 10000);
        showToast(wasLiked ? "Vote removed" : "Voted!", "success");
      } catch (error) {
        setLikedStates((p) => ({ ...p, [key]: wasLiked }));
        setVoteCountStates((p) => ({ ...p, [key]: prevCount }));
        showToast(error instanceof Error ? error.message : "Failed to vote", "error");
      } finally {
        votingLockRef.current[key] = false;
        setVotingStates((p) => ({ ...p, [key]: false }));
      }
    },
    [session, likedStates, voteCountStates, showToast]
  );

  const handleComment = useCallback((post: any) => setConversationPost(post), []);

  const handleShare = useCallback(async (post: any) => {
    try {
      const url = `https://skatehive.app/@${post.author}/${post.permlink}`;
      await Share.share({
        message: post.title ? `${post.title}\n\n${url}` : `Check this out\n\n${url}`,
        url,
      });
    } catch {}
  }, []);

  const handleOpenProfile = useCallback(
    (author: string) => {
      onClose();
      router.push(`/(tabs)/profile?username=${author}`);
    },
    [onClose, router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const key = postKey(item);
      return (
        <ImmersivePostItem
          post={item}
          isActive={index === currentIndex && visible && !conversationPost}
          width={width}
          height={height}
          isLiked={likedStates[key] ?? false}
          voteCount={voteCountStates[key] ?? 0}
          isVoting={votingStates[key] ?? false}
          canVote={canVote}
          isOwn={!!username && String(item.author).toLowerCase() === username.toLowerCase()}
          onVote={handleVote}
          onComment={handleComment}
          onShare={handleShare}
          onClose={onClose}
          onOpenProfile={handleOpenProfile}
          onToast={showToast}
        />
      );
    },
    [
      currentIndex, visible, conversationPost, width, height, likedStates,
      voteCountStates, votingStates, canVote, username, handleVote, handleComment,
      handleShare, onClose, handleOpenProfile, showToast,
    ]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        <View style={styles.container}>
        <FlatList
          data={posts}
          keyExtractor={postKey}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          initialScrollIndex={Math.min(initialIndex, Math.max(0, posts.length - 1))}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={hasMore ? onLoadMore : undefined}
          onEndReachedThreshold={0.8}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          windowSize={3}
          initialNumToRender={2}
        />
        </View>

        {conversationPost && (
          <FullConversationDrawer
            visible={!!conversationPost}
            onClose={() => setConversationPost(null)}
            author={conversationPost.author}
            permlink={conversationPost.permlink}
            partial
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    zIndex: 10,
  },
  author: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.primary },
  username: {
    color: "#fff",
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 3,
  },
  balance: {
    color: theme.colors.primary,
    fontSize: 15,
    fontFamily: theme.fonts.bold,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  dots: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
    zIndex: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: theme.colors.primary, width: 7, height: 7, borderRadius: 3.5 },
  caption: {
    position: "absolute",
    left: theme.spacing.md,
    right: 80,
    bottom: 40,
  },
  captionExpanded: {
    right: theme.spacing.md,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    padding: 10,
  },
  captionText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 4,
  },
  captionToggle: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    marginTop: 4,
  },
});
