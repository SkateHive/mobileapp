import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  Alert,
  ViewToken,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { ProfileSpectatorInfo } from "~/components/SpectatorMode/ProfileSpectatorInfo";
import { PostCard } from "~/components/Feed/PostCard";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { FollowersModal } from "~/components/Profile/FollowersModal";
import { EditProfileModal } from "~/components/Profile/EditProfileModal";
import { InstagramHandleModal } from "~/components/Instagram/InstagramHandleModal";
import {
  getIgHandle,
  setIgHandle as setIgHandleApi,
  deleteIgHandle,
  hasEligibleHiveAccount,
  isCrossPostEnabled,
  setCrossPostEnabled,
} from "~/lib/instagram";
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import { HIVE_AVATAR_URL } from "~/lib/constants";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { useUserComments } from "~/lib/hooks/useUserComments";
import { convertVestToHive, isMissingAccountError } from "~/lib/hive-utils";
import { loadUserbaseSession } from "~/lib/userbase/session-store";
import { getSession } from "~/lib/userbase/api";
import { canPost } from "~/lib/posting";
import * as Haptics from "expo-haptics";
import { extractMediaFromBody, filterDeletedPosts, formatPayout, metadataImageUrl } from "~/lib/utils";
import { Image } from "expo-image";
import { GridVideoTile } from "~/components/Profile/GridVideoTile";
import { ProfileHeader } from "~/components/Profile/ProfileHeader";
import { setViewerPayload, updateViewerPosts } from "~/lib/viewer-store";
import { useIsFocused } from "@react-navigation/native";
import { ActionSheet, type ActionSheetItem } from "~/components/ui/ActionSheet";

const GRID_COLS = 3;
const GRID_GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Skeleton grid shown while posts load
const SkeletonTile = React.memo(({ size, delay }: { size: number; delay: number }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return <Animated.View style={{ width: size, height: size, backgroundColor: theme.colors.secondaryCard, opacity }} />;
});

const GridSkeleton = ({ tileSize }: { tileSize: number }) => (
  <View style={skeletonStyles.container}>
    {Array.from({ length: 12 }).map((_, i) => (
      <SkeletonTile key={i} size={tileSize} delay={(i % 3) * 150} />
    ))}
  </View>
);

const skeletonStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});

export default function ProfileScreen() {
  const { username: currentUsername, logout, session, followingList, updateUserRelationship } =
    useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const isFocused = useIsFocused();
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  // Instagram handle management — only for accounts with an eligible (>=100 HP)
  // Hive account (key accounts, or email accounts with an eligible attached Hive).
  const [igEligible, setIgEligible] = useState(false);
  const [igModalVisible, setIgModalVisible] = useState(false);
  const [igHandle, setIgHandleState] = useState("");
  const [igSaving, setIgSaving] = useState(false);
  const [igCrossPost, setIgCrossPost] = useState(true);
  useEffect(() => {
    let cancelled = false;
    hasEligibleHiveAccount(session).then((ok) => {
      if (!cancelled) setIgEligible(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.username]);
  const [modalType, setModalType] = useState<'followers' | 'following' | 'muted'>('followers');
  const [profileTab, setProfileTab] = useState<'grid' | 'posts'>('grid');
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  // Hive Power of the account being viewed — not necessarily the signed-in one.
  // Uses the same definition as the Instagram gate (the account's own
  // vesting_shares), so the two never disagree for your own profile.
  const [hivePower, setHivePower] = useState<number | null>(null);
  // A lite account's picture comes from SkateHive's own server: it has no Hive
  // account, so images.hive.blog 404s for its handle.
  const [liteAvatar, setLiteAvatar] = useState<string | null>(null);
  // Only needed by poster-less video tiles, which fall back to a real player —
  // gating on visibility keeps offscreen clips from decoding.
  const [visibleGridItems, setVisibleGridItems] = useState<Set<string>>(new Set());
  // Budget for automatic page fetches that fill the grid (see auto-fill effect)
  const autoFillPagesRef = useRef(0);

  const onViewableGridItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const permlinks = viewableItems
        .filter(item => item.isViewable && item.item)
        .map(item => item.item.permlink);
      setVisibleGridItems(new Set(permlinks));
    }
  ).current;

  const gridViewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 30,
    minimumViewTime: 150,
  }).current;

  // Reset UI state when navigating between profiles
  const profileUsername = (params.username as string) || currentUsername;
  const isSpectator = profileUsername === "SPECTATOR";

  const isLiteOwnProfile =
    session?.kind === "userbase" && profileUsername === currentUsername;
  useEffect(() => {
    if (!isLiteOwnProfile || !currentUsername) return;
    let cancelled = false;
    // The stored copy is whatever the server said at login and is never
    // updated, so an avatar assigned afterwards would never show. Ask the
    // server, fall back to the copy.
    loadUserbaseSession().then(async (s) => {
      if (cancelled || !s?.user) return;
      setLiteAvatar(s.user.avatar_url);
      try {
        const fresh = await getSession(s.token);
        if (cancelled || !fresh?.success || !fresh.user) return;
        setLiteAvatar(fresh.user.avatar_url);
      } catch {
        // Offline or the endpoint is unhappy — the stored copy still stands.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isLiteOwnProfile, currentUsername]);
  useEffect(() => {
    setFollowersModalVisible(false);
    setEditProfileVisible(false);
    setSettingsMenuVisible(false);
    setProfileTab('grid');
    autoFillPagesRef.current = 0;
  }, [profileUsername]);

  const { hiveAccount, isLoading: isLoadingProfile, error, refetch: refetchAccount } =
    useHiveAccount(profileUsername);
  // A lite account with nothing on chain yet: its handle would only make the
  // node answer "account does not exist" (#61). The `!hiveAccount` half matters
  // as much as the session half: once the crew sponsors the account it does
  // exist, the profile below stops showing the explainer, and its posts have to
  // be fetched like anyone else's. Same condition as that render, deliberately.
  // And a node being down is not the same as an account not existing, or the
  // lite card would replace the grid for a sponsored user on a flaky connection.
  const accountIsMissing = !hiveAccount && (!error || isMissingAccountError(error));
  const liteWithoutHiveAccount = isLiteOwnProfile && accountIsMissing;
  const {
    posts: userPosts,
    isLoading: isLoadingPosts,
    loadNextPage,
    hasMore,
    refresh: refreshPosts,
  } = useUserComments(liteWithoutHiveAccount ? null : profileUsername);

  // Get thumbnail for a post — checks multiple sources
  const getPostThumbnail = useCallback((post: any): string | null => {
    let metadata: any = {};
    try {
      metadata = typeof post.json_metadata === 'string'
        ? JSON.parse(post.json_metadata)
        : (post.json_metadata || {});
    } catch {}

    // 1. Try json_metadata images (most reliable, set by posting apps)
    const metaImage = metadataImageUrl(metadata);
    if (metaImage) return metaImage;

    // 2. Try 3speak / video app thumbnail from json_metadata.video
    if (metadata?.video?.info?.snaphash) {
      return `https://threespeakvideo.b-cdn.net/${metadata.video.info.snaphash}/thumbnails/default.png`;
    }
    if (metadata?.video?.info?.thumbnail) {
      return metadata.video.info.thumbnail;
    }

    // 3. Parse body for markdown images
    const media = extractMediaFromBody(post.body);
    const img = media.find((m: any) => m.type === 'image');
    if (img) return img.url;

    // 4. Extract YouTube thumbnail from embed URLs in body
    const ytMatch = post.body?.match(
      /(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

    // 5. Try direct image URLs in body (not in markdown syntax)
    const directUrl = post.body?.match(
      /(https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp))(?=$|\s|[)"'])/i
    );
    if (directUrl) return directUrl[1];

    return null;
  }, []);

  // Check if a post has any media (image or video)
  const postHasMedia = useCallback((post: any): boolean => {
    // Check json_metadata.image
    try {
      const metadata = typeof post.json_metadata === 'string'
        ? JSON.parse(post.json_metadata)
        : post.json_metadata;
      if (metadata?.image?.length > 0) return true;
    } catch {}

    // Check body for media
    const media = extractMediaFromBody(post.body);
    if (media.length > 0) return true;

    // Check for direct image/video URLs
    const hasDirectMedia = /(https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|mp4|mov|m4v|m3u8))(?=$|\s|[)"'])/i
      .test(post.body || '');
    return hasDirectMedia;
  }, []);

  // Hide deleted/tombstoned posts everywhere on the profile.
  const visiblePosts = useMemo(() => filterDeletedPosts(userPosts), [userPosts]);

  // Filter posts to only those with media for the grid view
  const gridPosts = useMemo(() =>
    visiblePosts.filter(postHasMedia),
    [visiblePosts, postHasMedia]
  );

  // Feed later pages through to the viewer while it's open. It scrolls past the
  // end and calls loadNextPage, which lands here — and without this the store
  // would still hold the list as it was when the tile was tapped.
  useEffect(() => {
    updateViewerPosts(gridPosts, hasMore);
  }, [gridPosts, hasMore]);

  // Auto-fill the grid until it has enough items to be scrollable (~5 rows).
  // Without this, short first pages leave the list unscrollable and onEndReached
  // never fires again (its first call lands while isLoading is true and is
  // swallowed by loadNextPage's guard), so the grid stays stuck until a
  // pull-to-refresh gesture re-triggers it.
  // Capped at MAX_AUTO_FILL_PAGES so profiles with mostly text-only posts
  // (no media = no grid items) can't fetch forever — the unbounded version
  // of this loop previously caused OOM and RPC hammering.
  const MIN_GRID_ITEMS = 15;
  const MAX_AUTO_FILL_PAGES = 4;
  useEffect(() => {
    if (
      profileTab === 'grid' &&
      !isLoadingPosts &&
      hasMore &&
      userPosts.length > 0 &&
      gridPosts.length < MIN_GRID_ITEMS &&
      autoFillPagesRef.current < MAX_AUTO_FILL_PAGES
    ) {
      autoFillPagesRef.current += 1;
      loadNextPage();
    }
  }, [profileTab, isLoadingPosts, hasMore, gridPosts.length, userPosts.length, loadNextPage]);

  // Render grid item
  const tileSize = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

  const renderGridItem = useCallback(({ item, index }: { item: any; index: number }) => {
    if (!item?.body) {
      return <View style={[styles.gridTile, { width: tileSize, height: tileSize }]} />;
    }
    const media = extractMediaFromBody(item.body);
    const videoMedia = media.find((m: any) => m.type === 'video');

    // Tapping any tile opens the immersive post viewer at that post. The list
    // goes through the store because route params can only carry strings, and
    // this is a loaded page of posts plus the callback that fetches the next.
    const openViewer = () => {
      setViewerPayload({
        posts: gridPosts,
        initialIndex: index,
        hasMore,
        onLoadMore: loadNextPage,
      });
      router.push('/post-viewer');
    };

    // Earnings, bottom-left: the video badge already owns the other corner.
    // Hidden at zero — a grid of $0.00 makes a profile look dead. Bare text,
    // no chip: at three tiles per row the container was most of what you saw.
    const payout = formatPayout(item);
    const isVideo = !!videoMedia;
    const earnings =
      payout || isVideo ? (
        <View style={styles.gridEarnings} pointerEvents="none">
          {isVideo && (
            <Ionicons
              name="play-outline"
              size={13}
              color={theme.colors.primary}
              style={styles.gridPlayIcon}
            />
          )}
          {payout ? <Text style={styles.gridEarningsText}>{payout}</Text> : null}
        </View>
      ) : null;

    // Video posts show their poster frame; the clip plays in the viewer. Clips
    // without a poster keep the old inline player (see GridVideoTile).
    if (videoMedia) {
      return (
        <View>
          <GridVideoTile
            videoUrl={videoMedia.url}
            thumbnailUrl={getPostThumbnail(item)}
            size={tileSize}
            // Poster-less tiles fall back to a real player. Stop them whenever
            // this screen isn't the one in front — the viewer covers it now,
            // and a tab switch used to leave them decoding too.
            isVisible={isFocused && visibleGridItems.has(item.permlink)}
            onPress={openViewer}
          />
          {earnings}
        </View>
      );
    }

    // Image/embed posts show thumbnail
    const thumb = getPostThumbnail(item);
    return (
      <Pressable
        style={[styles.gridTile, { width: tileSize, height: tileSize }]}
        onPress={openViewer}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.gridImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name="image-outline" size={28} color={theme.colors.muted} />
          </View>
        )}
        {earnings}
      </Pressable>
    );
  }, [tileSize, getPostThumbnail, visibleGridItems, isFocused, gridPosts, hasMore, loadNextPage]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const openInstagramSettings = async () => {
    setSettingsMenuVisible(false);
    setIgModalVisible(true);
    setIgCrossPost(await isCrossPostEnabled());
    if (session) {
      const { handle } = await getIgHandle(session);
      setIgHandleState(handle || "");
    }
  };

  const saveInstagram = async (handle: string) => {
    if (!session) return setIgModalVisible(false);
    try {
      setIgSaving(true);
      await setIgHandleApi(handle, session);
      setIgHandleState(handle);
      showToast("Instagram handle saved", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save handle", "error");
    } finally {
      setIgSaving(false);
      setIgModalVisible(false);
    }
  };

  const removeInstagram = async () => {
    if (!session) return setIgModalVisible(false);
    try {
      setIgSaving(true);
      await deleteIgHandle(session);
      setIgHandleState("");
    } finally {
      setIgSaving(false);
      setIgModalVisible(false);
    }
  };

  // Own vesting converted to HP. The account is already loaded, so this only
  // costs the global-properties lookup convertVestToHive needs.
  useEffect(() => {
    const raw = hiveAccount?.vesting_shares;
    const vests = raw ? parseFloat(String(raw).split(' ')[0]) : 0;
    if (!vests) {
      setHivePower(null);
      return;
    }
    let cancelled = false;
    convertVestToHive(vests)
      .then((hp) => { if (!cancelled) setHivePower(hp); })
      .catch(() => { if (!cancelled) setHivePower(null); });
    return () => { cancelled = true; };
  }, [hiveAccount?.vesting_shares]);

  // "232 HP" means nothing to someone arriving from outside Hive, so the chip
  // explains itself on tap. The chip shows the *viewed* account's power, so the
  // copy can't talk about "your votes" on someone else's profile.
  const explainHivePower = () => {
    const isOwnProfile = profileUsername === currentUsername;
    Alert.alert(
      "Hive Power",
      isOwnProfile
        ? "Hive Power is how much influence your account has on Hive.\n\n" +
            "The more you hold, the more your votes are worth, so the posts you " +
            "vote on earn more, and so do you when others vote on yours.\n\n" +
            "You build it by earning rewards on your clips and keeping them as " +
            "Hive Power instead of cashing out."
        : "Hive Power is how much influence an account has on Hive.\n\n" +
            "The more someone holds, the more their votes are worth, so the " +
            "posts they vote on earn more, and they earn more when others vote " +
            "on theirs.\n\n" +
            "It grows by earning rewards on clips and keeping them as Hive Power " +
            "instead of cashing out.",
      [{ text: "Got it" }]
    );
  };

  const isFollowingProfile = followingList.includes(profileUsername ?? '');

  const handleFollowToggle = async () => {
    if (!session || !canPost(session)) {
      router.push('/login');
      return;
    }
    if (!profileUsername || isFollowLoading) return;

    const wasFollowing = isFollowingProfile;
    setIsFollowLoading(true);
    try {
      Haptics.impactAsync(
        wasFollowing ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
      // updateUserRelationship keeps followingList in sync, which is what the
      // button reads — calling setRelationship directly would leave the rest of
      // the app thinking otherwise.
      await updateUserRelationship(profileUsername, wasFollowing ? '' : 'blog');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not update follow',
        'error'
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleFollowersPress = () => {
    if (profileUsername === "SPECTATOR") return;
    setModalType('followers');
    setFollowersModalVisible(true);
  };

  const handleFollowingPress = () => {
    if (profileUsername === "SPECTATOR") return;
    setModalType('following');
    setFollowersModalVisible(true);
  };

  const handleMutedPress = () => {
    if (profileUsername === "SPECTATOR") return;
    setModalType('muted');
    setFollowersModalVisible(true);
  };

  const renderProfileImage = () => {
    if (profileUsername === "SPECTATOR") {
      return (
        <Image
          source={require("../../assets/images/icon-android.png")}
          style={styles.spectatorLogo}
        />
      );
    }

    const profileImage = hiveAccount?.metadata?.profile?.profile_image;
    const hiveAvatarUrl = `${HIVE_AVATAR_URL}/${profileUsername}/avatar/small`;

    if (profileImage) {
      return (
        <Image
          source={{ uri: profileImage }}
          style={styles.profileImage}
        />
      );
    }

    // Use Hive avatar as fallback
    if (profileUsername && profileUsername !== "SPECTATOR") {
      return (
        <Image
          source={{ uri: hiveAvatarUrl }}
          style={styles.profileImage}
        />
      );
    }

    // Default icon as last resort
    return (
      <View style={styles.defaultAvatar}>
        <Ionicons
          name="person-outline"
          size={48}
          color={theme.colors.text}
        />
      </View>
    );
  };

  // Saving the profile is a chain write, and hivemind has not indexed it by the
  // time the modal closes: refetching right away reads the old profile straight
  // back, which is why saving appeared to do nothing until the user pulled down
  // themselves. One retry a couple of blocks later lands the new one.
  //
  // Declared here, above every early return below: the loading and lite paths
  // return before this point, so a hook further down runs on some renders and
  // not others, which is what "rendered more hooks than during the previous
  // render" means.
  const savedRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedRetryRef.current) clearTimeout(savedRetryRef.current);
    },
    []
  );

  // Only when there is nothing to show yet: pull-to-refresh and the post-save
  // refetch both set this, and replacing a filled profile with a full-screen
  // spinner mid-gesture is worse than a header that updates a moment later.
  if (isLoadingProfile && !hiveAccount) {
    return <LoadingScreen />;
  }

  // Email/lite account with no on-chain Hive account yet — reuse the spectator
  // profile look (logo + handle) with a short, lite-specific CTA instead of a
  // wall of text or a profile-fetch error.
  if (liteWithoutHiveAccount) {
    return (
      <View style={styles.container}>
        {/* A real profile header, not a notice: same avatar, same name row as
            everyone else's. Seeing the shape of the thing is what makes wanting
            your own account obvious — the panel below stands in for the grid
            until there is a way to list a lite account's posts.

            The handle leads here, not a display name: it's the name being
            claimed on Hive, and the card below talks about it by name. And the
            stats read zero rather than being hidden, because an empty stat is
            the point — it shows what a Hive account would start filling. */}
        <ProfileHeader
          avatar={
            <Image
              source={
                liteAvatar
                  ? { uri: liteAvatar }
                  : require("../../assets/images/icon-android.png")
              }
              style={styles.profileImage}
              contentFit="cover"
            />
          }
          displayName={currentUsername ?? ""}
          handle={currentUsername ?? ""}
          hpLabel="0 HP"
          hpAccessibilityLabel="0 Hive Power"
          onHpPress={explainHivePower}
          stats={[
            { value: 0, label: "Clips" },
            { value: 0, label: "Following" },
            { value: 0, label: "Followers" },
          ]}
        />

        {/* Stands in for the grid, in the same place the clips would be. */}
        <View style={styles.liteCard}>
        {/* Short on purpose: this screen is where someone lands, not where they
            study — the long version is one tap away in About. And it asks for
            nothing: the crew sponsors an account on the first post, so telling
            people to go and create one themselves would only burn the name the
            sponsorship is going to register (#63). */}
        <Text style={styles.liteTitle}>Lite account</Text>
        <Text style={styles.liteBody}>
          You can post, comment and vote. Your posts go out through @skatehive
          until @{currentUsername} exists on Hive.
        </Text>
        <Text style={styles.liteAvailable}>
          Post your first clip and the crew sponsors @{currentUsername} for you.
        </Text>

        <Pressable onPress={() => router.push("/about")} style={styles.liteLearnMore}>
          <Text style={styles.liteLearnMoreText}>How this works ›</Text>
        </Pressable>

          {/* handleLogout, not logout: it catches a failed sign-out and leaves
              for "/" afterwards. Calling the raw one left you on a profile you
              were no longer signed into. */}
          <Pressable onPress={handleLogout} style={styles.liteLogout}>
            <Text style={styles.liteLogoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Only show error for non-SPECTATOR users when there's an actual error or missing account
  if (profileUsername !== "SPECTATOR" && (error || !hiveAccount)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {error || "Error loading profile"}
        </Text>
      </View>
    );
  }

  // Render the profile header section
  const renderProfileHeader = () => (
    <View>
      <ProfileHeader
        avatar={renderProfileImage()}
        displayName={
          hiveAccount?.metadata?.profile?.name || hiveAccount?.name || profileUsername
        }
        handle={profileUsername ?? ""}
        location={hiveAccount?.metadata?.profile?.location}
        bio={hiveAccount?.metadata?.profile?.about}
        // Hidden until HP resolves, rather than showing a placeholder zero the
        // way a lite account does: here the number is coming, it is not absent.
        hpLabel={
          hivePower !== null && hivePower > 0 ? `${Math.round(hivePower)} HP` : null
        }
        hpAccessibilityLabel={
          hivePower !== null ? `${Math.round(hivePower)} Hive Power` : undefined
        }
        onHpPress={explainHivePower}
        trailingAction={
          !params.username && (
            <Pressable
              onPress={() => setSettingsMenuVisible(!settingsMenuVisible)}
              hitSlop={12}
              style={styles.gearIcon}
            >
              <Ionicons name="settings-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          )
        }
        stats={[
          { value: gridPosts.length, label: "Clips" },
          {
            value: hiveAccount?.profile?.stats?.following || "0",
            label: "Following",
            // A spectator has nobody to list, so the cell stays flat.
            onPress: isSpectator ? undefined : handleFollowingPress,
          },
          {
            value: hiveAccount?.profile?.stats?.followers || "0",
            label: "Followers",
            onPress: isSpectator ? undefined : handleFollowersPress,
          },
        ]}
        // Follow lives only on someone else's profile — your own keeps Edit
        // Profile behind the gear, as before.
        footer={
          !!params.username && profileUsername !== currentUsername && !isSpectator && (
            <Pressable
              onPress={handleFollowToggle}
              disabled={isFollowLoading}
              style={({ pressed }) => [
                styles.followButton,
                isFollowingProfile ? styles.followButtonActive : styles.followButtonIdle,
                { opacity: isFollowLoading ? 0.5 : pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFollowingProfile ? `Unfollow ${profileUsername}` : `Follow ${profileUsername}`}
              accessibilityState={{ selected: isFollowingProfile, disabled: isFollowLoading }}
            >
              <Text
                style={[
                  styles.followButtonText,
                  isFollowingProfile ? styles.followButtonTextActive : styles.followButtonTextIdle,
                ]}
              >
                {isFollowingProfile ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )
        }
      />

      {/* Show Create Account CTA only for SPECTATOR */}
      {profileUsername === "SPECTATOR" && <ProfileSpectatorInfo />}

      {/* Tab Switcher */}
      {profileUsername !== "SPECTATOR" && (
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, profileTab === 'grid' && styles.tabActive]}
            onPress={() => setProfileTab('grid')}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={profileTab === 'grid' ? theme.colors.primary : theme.colors.muted}
            />
          </Pressable>
          <Pressable
            style={[styles.tab, profileTab === 'posts' && styles.tabActive]}
            onPress={() => setProfileTab('posts')}
          >
            <Ionicons
              name="list-outline"
              size={20}
              color={profileTab === 'posts' ? theme.colors.primary : theme.colors.muted}
            />
          </Pressable>
        </View>
      )}
    </View>
  );

  // Render individual post item
  const renderPostItem = ({ item }: { item: any }) => (
    <PostCard
      key={item.permlink}
      post={item}
      currentUsername={currentUsername || ''}
    />
  );

  // Render separator between posts
  const renderSeparator = () => <View style={styles.postSeparator} />;

  // Render footer loading indicator
  const renderFooter = () => {
    if (!isLoadingPosts) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  };

  // Handle refresh
  const handleRefresh = () => {
    autoFillPagesRef.current = 0;
    refreshPosts();
    // The header is half of this screen. Pulling down used to refresh only the
    // grid, leaving avatar, bio and Hive Power frozen (#65).
    refetchAccount();
  };

  const handleProfileSaved = () => {
    // The account only: a bio or avatar edit leaves the grid untouched.
    refetchAccount();
    if (savedRetryRef.current) clearTimeout(savedRetryRef.current);
    savedRetryRef.current = setTimeout(() => refetchAccount(), 6000);
  };

  return (
    <View style={styles.container}>
      {profileUsername === "SPECTATOR" ? (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={isLoadingPosts} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderProfileHeader()}
        </ScrollView>
      ) : profileTab === 'grid' ? (
        <FlatList
          key="grid"
          data={gridPosts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.permlink}
          numColumns={GRID_COLS}
          columnWrapperStyle={{ gap: GRID_GAP }}
          ListHeaderComponent={renderProfileHeader}
          ListFooterComponent={
            isLoadingPosts ? (
              <GridSkeleton tileSize={tileSize} />
            ) : null
          }
          ListEmptyComponent={
            !isLoadingPosts ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.noPostsText}>No posts yet</Text>
              </View>
            ) : null
          }
          onEndReached={hasMore ? loadNextPage : undefined}
          onEndReachedThreshold={0.8}
          refreshControl={
            <RefreshControl refreshing={isLoadingPosts} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          windowSize={7}
          contentContainerStyle={{ gap: GRID_GAP }}
          onViewableItemsChanged={onViewableGridItemsChanged}
          viewabilityConfig={gridViewabilityConfig}
        />
      ) : (
        <FlatList
          key="posts"
          data={visiblePosts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.permlink}
          ListHeaderComponent={renderProfileHeader}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !isLoadingPosts ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.noPostsText}>No posts yet</Text>
              </View>
            ) : null
          }
          onEndReached={hasMore ? loadNextPage : undefined}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isLoadingPosts} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={7}
          contentContainerStyle={styles.contentContainer}
        />
      )}

      {/* Followers/Following/Muted Modal */}
      {profileUsername !== "SPECTATOR" && (
        <FollowersModal
          visible={followersModalVisible}
          onClose={() => setFollowersModalVisible(false)}
          username={profileUsername || ''}
          type={modalType}
        />
      )}

      {/* Edit Profile Modal */}
      {!params.username && (
        <EditProfileModal
          visible={editProfileVisible}
          onClose={() => setEditProfileVisible(false)}
          currentProfile={hiveAccount?.metadata?.profile || {}}
          onSaved={handleProfileSaved}
        />
      )}

      {/* Settings action sheet (gear menu) */}
      <ActionSheet
        visible={settingsMenuVisible}
        onClose={() => setSettingsMenuVisible(false)}
        title="Settings"
        subtitle={currentUsername ? `@${currentUsername}` : undefined}
        items={[
          {
            key: "edit",
            icon: "create-outline",
            title: "Edit Profile",
            subtitle: "Name, bio & avatar",
            variant: "primary",
            onPress: () => {
              setEditProfileVisible(true);
            },
          },
          ...(igEligible
            ? [
                {
                  key: "instagram",
                  icon: "logo-instagram",
                  title: "Instagram",
                  subtitle: "Cross-post your clips",
                  variant: "secondary",
                  onPress: () => {
                    openInstagramSettings();
                  },
                } as ActionSheetItem,
              ]
            : []),
          {
            key: "logout",
            icon: "log-out-outline",
            title: "Logout",
            subtitle: currentUsername ? `Sign out @${currentUsername}` : "Sign out",
            variant: "danger",
            onPress: () => {
              handleLogout();
            },
          },
        ]}
      />

      <InstagramHandleModal
        visible={igModalVisible}
        initialHandle={igHandle}
        saving={igSaving}
        onSave={saveInstagram}
        onRemove={removeInstagram}
        onClose={() => setIgModalVisible(false)}
        showCrossPostToggle
        crossPostEnabled={igCrossPost}
        onCrossPostChange={(enabled) => {
          setIgCrossPost(enabled);
          setCrossPostEnabled(enabled);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  gearIcon: {
    padding: theme.spacing.xs,
  },
  followButton: {
    minHeight: 36,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  followButtonIdle: {
    backgroundColor: theme.colors.primary,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  followButtonText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  followButtonTextIdle: {
    color: theme.colors.black,
  },
  followButtonTextActive: {
    color: theme.colors.muted,
  },
  spectatorAvatar: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spectatorLogo: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    borderWidth: 4,
    borderColor: theme.colors.background,
  },
  defaultAvatar: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: theme.colors.background,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  powerStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  feedContainer: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  postSeparator: {
    height: 0,
    marginVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.muted,
  },
  noPostsText: {
    textAlign: 'center',
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  loadingFooter: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  // Grid
  gridTile: {
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryCard,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  // Sits where the grid would be, so the screen reads as a profile with its
  // content area explained rather than as an error page.
  liteCard: {
    flex: 1,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  liteAvailable: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: theme.spacing.sm,
  },
  liteTitle: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    marginTop: theme.spacing.md,
  },
  liteBody: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: theme.spacing.sm,
  },
  liteLogout: {
    marginTop: theme.spacing.lg,
  },
  liteLogoutText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  liteLearnMore: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  liteLearnMoreText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  gridEarnings: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridPlayIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridEarningsText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xxs,
    // No pill behind it, so the shadow is what keeps it readable over a light
    // frame of the photo.
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondaryCard,
  },
  gridVideoIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
});
