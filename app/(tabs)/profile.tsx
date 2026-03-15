import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  FlatList,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { ProfileSpectatorInfo } from "~/components/SpectatorMode/ProfileSpectatorInfo";
import { PostCard } from "~/components/Feed/PostCard";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { FollowersModal } from "~/components/Profile/FollowersModal";
import { useFocusEffect } from '@react-navigation/native';
import { EditProfileModal } from "~/components/Profile/EditProfileModal";

const { width } = Dimensions.get('window');
import { theme } from "~/lib/theme";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { useToast } from "~/lib/toast-provider";
import { useUserComments } from '~/lib/hooks/useUserComments';
import { useScrollLock } from '~/lib/ScrollLockContext';
import { ConversationDrawer } from '~/components/Feed/ConversationDrawer';
import type { Discussion } from '@hiveio/dhive';
import { extractMediaFromBody } from "~/lib/utils";
import { GridVideoTile } from "~/components/Profile/GridVideoTile";
import { VideoPlayer } from '~/components/Feed/VideoPlayer';

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
  <View style={[skeletonStyles.container, { width: SCREEN_WIDTH }]}>
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
    justifyContent: 'flex-start',
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
  
  // Try exact match first
  if (map[loc]) return map[loc];
  
  // Try finding a known country/code as a full word in the string
  for (const [key, flag] of Object.entries(map)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(loc)) return flag;
  }
  
  return '🌎';
}

export default function ProfileScreen() {
  const { username: currentUsername, logout } = useAuth();
  const { isScrollLocked } = useScrollLock();
  const params = useLocalSearchParams();
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following' | 'muted'>('followers');
  const [conversationPost, setConversationPost] = useState<Discussion | null>(null);
  const [profileTab, setProfileTab] = useState<'grid' | 'posts'>('grid');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const { followingList, blockedList, updateUserRelationship, session, refreshUserRelationships } = useAuth();
  const { showToast } = useToast();

  // Reset UI state when navigating between profiles
  const profileUsername = (params.username as string) || currentUsername;
  useEffect(() => {
    setFollowersModalVisible(false);
    setEditProfileVisible(false);
    setSettingsMenuVisible(false);
    setProfileTab('grid');
    setIsFollowLoading(false);
  }, [profileUsername]);

  // Force refresh relationships when visiting a profile to ensure following status is accurate
  useEffect(() => {
    if (typeof currentUsername === 'string' && currentUsername !== "SPECTATOR") {
      console.log(`[Profile Sync] Forcing relationship refresh for @${currentUsername} while viewing @${profileUsername}`);
      refreshUserRelationships().catch(console.error);
    }
  }, [profileUsername, currentUsername, refreshUserRelationships]);

  // Sync following status with global list
  useEffect(() => {
    if (followingList && profileUsername) {
      const profileLower = profileUsername.toLowerCase();
      const following = followingList.some((u: string) => u.toLowerCase() === profileLower);
      
      console.log(`[Profile Sync] Checking if @${profileLower} is in followingList: ${following}`);
      console.log(` - Current followingList size: ${followingList.length}`);
      
      if (!following && followingList.length < 10) {
        console.log(" - followingList (first 10):", followingList.slice(0, 10));
      }
      
      setIsFollowing(following);
    }
    
    if (blockedList && profileUsername) {
      const profileLower = profileUsername.toLowerCase();
      const blocked = blockedList.some((u: string) => u.toLowerCase() === profileLower);
      setIsBlocked(blocked);
    }
  }, [followingList, blockedList, profileUsername]);

  const handleFollow = async () => {
    if (!profileUsername || profileUsername === "SPECTATOR") return;
    
    if (!currentUsername || currentUsername === "SPECTATOR" || !session?.decryptedKey) {
      showToast('Please login first', 'error');
      return;
    }

    try {
      setIsFollowLoading(true);
      const isCurrentlyFollowing = followingList.some((u: string) => u.toLowerCase() === profileUsername.toLowerCase());
      const action = isCurrentlyFollowing ? '' : 'blog'; // '' unsets relationship (unfollow)
      
      const success = await updateUserRelationship(profileUsername, action);
      if (success) {
        showToast(isCurrentlyFollowing ? `Unfollowed @${profileUsername}` : `Following @${profileUsername}`, 'success');
      } else {
        showToast(`Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} user`, 'error');
      }
    } catch (error) {
      showToast('Error updating relationship', 'error');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!profileUsername || profileUsername === "SPECTATOR") return;
    
    if (!currentUsername || currentUsername === "SPECTATOR" || !session?.decryptedKey) {
      showToast('Please login first', 'error');
      return;
    }

    try {
      setIsBlockLoading(true);
      const action = isBlocked ? '' : 'ignore'; // Default to ignore for blocking
      
      const success = await updateUserRelationship(profileUsername, action);
      if (success) {
        showToast(isBlocked ? `Unblocked @${profileUsername}` : `Blocked @${profileUsername}`, 'success');
        // If we just blocked them, we should also unfollow if we following
        if (action === 'ignore' && isFollowing) {
           setIsFollowing(false);
        }
      } else {
        showToast(`Failed to ${isBlocked ? 'unblock' : 'block'} user`, 'error');
      }
    } catch (error) {
      showToast('Error updating relationship', 'error');
    } finally {
      setIsBlockLoading(false);
    }
  };

  const { hiveAccount, isLoading: isLoadingProfile, error } = useHiveAccount(profileUsername);
  const {
    posts: userPosts,
    isLoading: isLoadingPosts,
    loadNextPage,
    hasMore,
    refresh: refreshPosts,
  } = useUserComments(profileUsername, blockedList);

  // Get thumbnail for a post — checks multiple sources
  const getPostThumbnail = useCallback((post: any): string | null => {
    let metadata: any = {};
    try {
      metadata = typeof post.json_metadata === 'string'
        ? JSON.parse(post.json_metadata)
        : (post.json_metadata || {});
    } catch {}

    // 1. Try json_metadata.image (most reliable, set by posting apps)
    if (metadata?.image) {
      const imgs = Array.isArray(metadata.image) ? metadata.image : [metadata.image];
      if (imgs[0]) return imgs[0];
    }

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

  // Filter posts to only those with media for the grid view
  const gridPosts = useMemo(() =>
    userPosts.filter(postHasMedia),
    [userPosts, postHasMedia]
  );

  // Auto-load more when grid doesn't have enough items to fill the screen
  // REMOVED: This was causing infinite loops and crashes (OOM) on profiles with many media-less posts.
  // The user can still scroll down to trigger loadNextPage via onEndReached.

  // Render grid item
  const tileSize = (SCREEN_WIDTH - (GRID_GAP * (GRID_COLS - 1))) / GRID_COLS - 0.5;

  const renderGridItem = useCallback(({ item }: { item: any }) => {
    const media = extractMediaFromBody(item.body);
    const videoMedia = media.find((m: any) => m.type === 'video');

    // Video posts autoplay muted when in view
    if (videoMedia) {
      return (
        <GridVideoTile
          videoUrl={videoMedia.url}
          size={tileSize}
          onPress={() => setConversationPost(item)}
        />
      );
    }

    // Image/embed posts show thumbnail
    const thumb = getPostThumbnail(item);
    return (
      <Pressable
        style={[styles.gridTile, { width: tileSize, height: tileSize }]}
        onPress={() => setConversationPost(item)}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name="image-outline" size={28} color={theme.colors.muted} />
          </View>
        )}
      </Pressable>
    );
  }, [tileSize, getPostThumbnail]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
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
        <View style={styles.spectatorAvatar}>
          <Ionicons
            name="eye-outline"
            size={48}
            color={theme.colors.primary}
          />
        </View>
      );
    }

    const profileImage = hiveAccount?.metadata?.profile?.profile_image;
    const hiveAvatarUrl = `https://images.hive.blog/u/${profileUsername}/avatar/small`;

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

  // Calculate stats from hiveAccount (only for non-SPECTATOR users)
  let reputation = 25; // Default reputation
  let hivepower = 0; // Default hive power
  let vp = 100; // Default voting power
  let rc = 100; // Default RC
  
  if (profileUsername !== "SPECTATOR" && hiveAccount) {
    // Use reputation from profile data if available, otherwise calculate it
    reputation = hiveAccount.profile?.reputation || 
      (hiveAccount.reputation ? 
        Math.log10(Math.abs(Number(hiveAccount.reputation))) * 9 + 25 : 25);
    
    const vestingShares = parseFloat(typeof hiveAccount.vesting_shares === 'string' ? hiveAccount.vesting_shares.split(' ')[0] : hiveAccount.vesting_shares.amount.toString());
    const receivedVestingShares = parseFloat(typeof hiveAccount.received_vesting_shares === 'string' ? hiveAccount.received_vesting_shares.split(' ')[0] : hiveAccount.received_vesting_shares.amount.toString());
    const delegatedVestingShares = parseFloat(typeof hiveAccount.delegated_vesting_shares === 'string' ? hiveAccount.delegated_vesting_shares.split(' ')[0] : hiveAccount.delegated_vesting_shares.amount.toString());
    const totalVests = vestingShares + receivedVestingShares - delegatedVestingShares;
    
    // Simple HP calculation (actual conversion requires global props)
    hivepower = totalVests / 1000; // Simplified calculation

    vp = hiveAccount.voting_power ? hiveAccount.voting_power / 100 : 100;
  }

  // Render the profile header section
  const renderProfileHeader = () => {
    return (
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
            {/* Username + Action Buttons */}
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{profileUsername}</Text>
              <View style={styles.headerActionsRaw}>
                {currentUsername && profileUsername !== currentUsername && profileUsername !== "SPECTATOR" && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isBlocked ? (
                      <Pressable
                        style={[styles.followActionBtn, styles.mutedActionBtn]}
                        onPress={handleBlock}
                        disabled={isBlockLoading}
                      >
                        {isBlockLoading ? (
                          <ActivityIndicator size="small" color={theme.colors.danger} />
                        ) : (
                          <Text style={[styles.followActionBtnText, { color: theme.colors.danger }]}>
                            Blocked
                          </Text>
                        )}
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[
                          styles.followActionBtn,
                          isFollowing ? styles.unfollowBtn : styles.followBtn
                        ]}
                        onPress={handleFollow}
                        disabled={isFollowLoading}
                      >
                        {isFollowLoading ? (
                          <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : theme.colors.background} />
                        ) : (
                          <Text style={[
                            styles.followActionBtnText,
                            isFollowing ? styles.unfollowBtnText : styles.followBtnText
                          ]}>
                            {isFollowing ? 'Unfollow' : 'Follow'}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Stats + flag inline */}
            <View style={styles.statsRow}>
              {profileUsername === "SPECTATOR" ? (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.following || "0"}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              ) : (
                <Pressable style={styles.statItem} onPress={handleFollowingPress}>
                  <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.following || "0"}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </Pressable>
              )}
              {profileUsername === "SPECTATOR" ? (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.followers || "0"}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
              ) : (
                <Pressable style={styles.statItem} onPress={handleFollowersPress}>
                  <Text style={styles.statValue}>{hiveAccount?.profile?.stats?.followers || "0"}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </Pressable>
              )}
              {hiveAccount?.metadata?.profile?.location && (
                <View style={styles.statItem}>
                  <Text style={styles.locationFlag}>
                    {countryToFlag(hiveAccount.metadata.profile.location)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {hiveAccount.metadata.profile.location}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
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
  };

  // Render individual post item
  const renderPostItem = ({ item }: { item: any }) => (
    <PostCard
      key={item.permlink}
      post={item}
      currentUsername={currentUsername || ''}
      onOpenConversation={(post) => setConversationPost(post)}
    />
  );

  // Render separator between posts
  const renderSeparator = () => <View style={styles.postSeparator} />;

  // Render footer loading indicator
  const renderFooter = () => {
    if (!isLoadingPosts) return null;
    return (
      <View style={styles.loadingFooter}>
        <LoadingScreen />
      </View>
    );
  };

  // Handle refresh
  const handleRefresh = () => {
    refreshPosts();
  };

  return (
    <View style={styles.container}>
      {profileUsername === "SPECTATOR" ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isLoadingPosts} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isScrollLocked}
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
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isLoadingPosts} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={3}
          windowSize={3}
          contentContainerStyle={{ gap: GRID_GAP, paddingTop: 100, paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          key="posts"
          data={userPosts}
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
          scrollEnabled={!isScrollLocked}
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

      {/* Single shared conversation drawer */}
      {conversationPost && (
        <ConversationDrawer
          isVisible={!!conversationPost}
          onClose={() => setConversationPost(null)}
          post={conversationPost}
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

      {/* Settings Dialog */}
      <Modal
        visible={settingsMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsMenuVisible(false)}
      >
        <Pressable style={styles.dialogOverlay} onPress={() => setSettingsMenuVisible(false)}>
          <View style={styles.dialogBox}>
            <Pressable
              style={styles.dialogItem}
              onPress={() => {
                setSettingsMenuVisible(false);
                setEditProfileVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.dialogItemText}>Edit Profile</Text>
            </Pressable>
            <View style={styles.dialogDivider} />
            <Pressable
              style={styles.dialogItem}
              onPress={() => {
                setSettingsMenuVisible(false);
                handleMutedPress();
              }}
            >
              <Ionicons name="volume-mute-outline" size={20} color={theme.colors.muted} />
              <Text style={styles.dialogItemText}>Muted Users</Text>
            </Pressable>
            <View style={styles.dialogDivider} />
            <Pressable
              style={styles.dialogItem}
              onPress={() => {
                setSettingsMenuVisible(false);
                handleLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.dialogItemText, { color: theme.colors.danger }]}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    paddingTop: 100, // Space for absolute header
    paddingBottom: 100, // Space for absolute tab bar
  },
  // Profile Section Styles
  profileSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
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
  locationFlag: {
    fontSize: 18,
  },
  gearIcon: {
    padding: theme.spacing.xs,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBox: {
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 220,
    overflow: 'hidden',
  },
  dialogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  dialogItemText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
  },
  dialogDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  followActionBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  unfollowBtn: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  followActionBtnText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
  },
  followBtnText: {
    color: theme.colors.background,
  },
  unfollowBtnText: {
    color: theme.colors.text,
  },
  mutedActionBtn: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: theme.colors.danger,
    minWidth: 40,
  },
  unmuteActionBtn: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
    minWidth: 40,
  },
  headerActionsRaw: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  statLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    marginTop: theme.spacing.xxs,
  },
  spectatorAvatar: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
