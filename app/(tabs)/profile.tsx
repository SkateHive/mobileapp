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
import { convertVestToHive } from "~/lib/hive-utils";
import { canPost } from "~/lib/posting";
import * as Haptics from "expo-haptics";
import { extractMediaFromBody, filterDeletedPosts, formatPayout, metadataImageUrl } from "~/lib/utils";
import { Image } from "expo-image";
import { GridVideoTile } from "~/components/Profile/GridVideoTile";
import { ImmersivePostViewer } from "~/components/Feed/ImmersivePostViewer";
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

// Map common country names/codes to flag emojis
function countryToFlag(location: string): string {
  const loc = location.trim().toUpperCase();
  const map: Record<string, string> = {
    BR: '🇧🇷', BRAZIL: '🇧🇷', BRASIL: '🇧🇷',
    US: '🇺🇸', USA: '🇺🇸', 'UNITED STATES': '🇺🇸',
    UK: '🇬🇧', GB: '🇬🇧', 'UNITED KINGDOM': '🇬🇧', ENGLAND: '🇬🇧',
    DE: '🇩🇪', GERMANY: '🇩🇪', DEUTSCHLAND: '🇩🇪',
    FR: '🇫🇷', FRANCE: '🇫🇷',
    ES: '🇪🇸', SPAIN: '🇪🇸', ESPAÑA: '🇪🇸',
    PT: '🇵🇹', PORTUGAL: '🇵🇹',
    MX: '🇲🇽', MEXICO: '🇲🇽', MÉXICO: '🇲🇽',
    CA: '🇨🇦', CANADA: '🇨🇦',
    AR: '🇦🇷', ARGENTINA: '🇦🇷',
    AU: '🇦🇺', AUSTRALIA: '🇦🇺',
    JP: '🇯🇵', JAPAN: '🇯🇵',
    NL: '🇳🇱', NETHERLANDS: '🇳🇱',
    IT: '🇮🇹', ITALY: '🇮🇹', ITALIA: '🇮🇹',
    CL: '🇨🇱', CHILE: '🇨🇱',
    CO: '🇨🇴', COLOMBIA: '🇨🇴',
    PE: '🇵🇪', PERU: '🇵🇪',
    VE: '🇻🇪', VENEZUELA: '🇻🇪',
    SE: '🇸🇪', SWEDEN: '🇸🇪',
    NO: '🇳🇴', NORWAY: '🇳🇴',
    CR: '🇨🇷', 'COSTA RICA': '🇨🇷',
    ZA: '🇿🇦', 'SOUTH AFRICA': '🇿🇦',
    IN: '🇮🇳', INDIA: '🇮🇳',
    PH: '🇵🇭', PHILIPPINES: '🇵🇭',
  };
  // Try exact match first, then check if location contains a known key
  if (map[loc]) return map[loc];
  for (const [key, flag] of Object.entries(map)) {
    if (loc.includes(key)) return flag;
  }
  return '🌍';
}

export default function ProfileScreen() {
  const { username: currentUsername, logout, session, followingList, updateUserRelationship } =
    useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
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
  // Index (within gridPosts) of the post open in the immersive viewer; null = closed.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  // Hive Power of the account being viewed — not necessarily the signed-in one.
  // Uses the same definition as the Instagram gate (the account's own
  // vesting_shares), so the two never disagree for your own profile.
  const [hivePower, setHivePower] = useState<number | null>(null);
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
  useEffect(() => {
    setFollowersModalVisible(false);
    setEditProfileVisible(false);
    setSettingsMenuVisible(false);
    setProfileTab('grid');
    autoFillPagesRef.current = 0;
  }, [profileUsername]);

  const { hiveAccount, isLoading: isLoadingProfile, error } = useHiveAccount(profileUsername);
  const {
    posts: userPosts,
    isLoading: isLoadingPosts,
    loadNextPage,
    hasMore,
    refresh: refreshPosts,
  } = useUserComments(profileUsername);

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

    // Tapping any tile opens the immersive post viewer at that post.
    const openViewer = () => setViewerIndex(index);

    // Earnings, bottom-left: the video badge already owns the other corner.
    // Hidden at zero — a grid of $0.00 makes a profile look dead.
    const payout = formatPayout(item);
    const earnings = payout ? (
      <View style={styles.gridEarnings} pointerEvents="none">
        <Text style={styles.gridEarningsText}>{payout}</Text>
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
            // Poster-less tiles fall back to a real player. Stop them while the
            // viewer is open on top: nothing is visible, and they still decode.
            isVisible={viewerIndex === null && visibleGridItems.has(item.permlink)}
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
  }, [tileSize, getPostThumbnail, visibleGridItems, viewerIndex]);

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
            "The more you hold, the more your votes are worth — so the posts you " +
            "vote on earn more, and so do you when others vote on yours.\n\n" +
            "You build it by earning rewards on your clips and keeping them as " +
            "Hive Power instead of cashing out."
        : "Hive Power is how much influence an account has on Hive.\n\n" +
            "The more someone holds, the more their votes are worth — so the " +
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

  if (isLoadingProfile) {
    return <LoadingScreen />;
  }

  // Email/lite account with no on-chain Hive account yet — reuse the spectator
  // profile look (logo + handle) with a short, lite-specific CTA instead of a
  // wall of text or a profile-fetch error.
  if (
    session?.kind === "userbase" &&
    profileUsername === currentUsername &&
    (error || !hiveAccount)
  ) {
    return (
      <View style={styles.errorContainer}>
        <Image
          source={require("../../assets/images/icon-android.png")}
          style={styles.spectatorLogo}
        />
        <Text style={[styles.profileName, { marginTop: theme.spacing.md }]}>
          @{currentUsername}
        </Text>
        <Text
          style={[
            styles.errorText,
            {
              marginTop: 10,
              textAlign: "center",
              paddingHorizontal: 32,
              color: theme.colors.muted,
              lineHeight: 20,
            },
          ]}
        >
          Lite account — your posts go out via @skatehive. Get sponsored to
          claim @{currentUsername} on Hive.
        </Text>
        <Pressable onPress={logout} style={{ marginTop: 24 }}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md }}>
            Log out
          </Text>
        </Pressable>
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
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileImageContainer}>
            {renderProfileImage()}
          </View>

          <View style={styles.nameSection}>
            {/* Name row with gear icon */}
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {hiveAccount?.metadata?.profile?.name || hiveAccount?.name || profileUsername}
              </Text>
              {!params.username && (
                <Pressable
                  onPress={() => setSettingsMenuVisible(!settingsMenuVisible)}
                  hitSlop={12}
                  style={styles.gearIcon}
                >
                  <Ionicons name="settings-outline" size={18} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>

            {/* Handle, with country inline. Two lines because a long handle plus
                a long country ("UNITED KINGDOM") would otherwise clip the country
                away entirely — the column is already narrowed by the avatar. */}
            <Text style={styles.username} numberOfLines={2}>
              @{profileUsername}
              {!!hiveAccount?.metadata?.profile?.location && (
                <Text style={styles.username}>
                  {"  ·  "}
                  {countryToFlag(hiveAccount.metadata.profile.location)}{" "}
                  {hiveAccount.metadata.profile.location}
                </Text>
              )}
            </Text>

            {/* Trimmed: bios routinely carry a trailing newline, which renders
                as an empty second line. */}
            {!!hiveAccount?.metadata?.profile?.about?.trim() && (
              <Text style={styles.bio} numberOfLines={2}>
                {hiveAccount.metadata.profile.about.trim()}
              </Text>
            )}

            {/* Hive Power. Hidden until it resolves — the design asked for an
                "earned" figure, which nothing exposes; HP is a real number the
                app already trusts elsewhere. */}
            {hivePower !== null && hivePower > 0 && (
              <Pressable
                style={styles.hpChip}
                onPress={explainHivePower}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${Math.round(hivePower)} Hive Power. What is this?`}
              >
                <Text style={styles.hpChipText}>{Math.round(hivePower)} HP</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={12}
                  color={theme.colors.muted}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{gridPosts.length}</Text>
            <Text style={styles.statLabel}>Clips</Text>
          </View>

          <Pressable
            style={[styles.statCell, styles.statCellMiddle]}
            onPress={handleFollowingPress}
            disabled={profileUsername === "SPECTATOR"}
          >
            <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.following || "0"}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>

          <Pressable
            style={styles.statCell}
            onPress={handleFollowersPress}
            disabled={profileUsername === "SPECTATOR"}
          >
            <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.followers || "0"}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
        </View>

        {/* Follow lives only on someone else's profile — your own keeps Edit
            Profile behind the gear, as before. */}
        {!!params.username && profileUsername !== currentUsername && profileUsername !== "SPECTATOR" && (
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
        )}
      </View>

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

      {/* Immersive post viewer — opens on the tapped grid post, swipe for more */}
      {viewerIndex !== null && (
        <ImmersivePostViewer
          visible={viewerIndex !== null}
          posts={gridPosts}
          initialIndex={viewerIndex}
          hasMore={hasMore}
          onLoadMore={loadNextPage}
          onClose={() => setViewerIndex(null)}
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
          onSaved={handleRefresh}
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
  // Profile Section Styles
  profileSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  profileImageContainer: {
    // No need for alignSelf since it's in a row now
  },
  nameSection: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gearIcon: {
    padding: theme.spacing.xs,
  },
  profileName: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    lineHeight: theme.fontSizes.xl * 1.2,
  },
  username: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  bio: {
    color: theme.colors.white,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    lineHeight: 18,
    opacity: 0.8,
  },
  hpChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: theme.spacing.xxs,
  },
  hpChipText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xxs,
    color: theme.colors.primary,
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 10,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statCellMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
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
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  statLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xxs,
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
  gridEarnings: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  gridEarningsText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xxs,
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
