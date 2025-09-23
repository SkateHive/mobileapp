import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  FlatList,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { ProfileSpectatorInfo } from "~/components/SpectatorMode/ProfileSpectatorInfo";
import { PostCard } from "~/components/Feed/PostCard";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { FollowersModal } from "~/components/Profile/FollowersModal";
import { theme } from "~/lib/theme";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { useUserComments } from "~/lib/hooks/useUserComments";

export default function ProfileScreen() {
  const { username: currentUsername, logout } = useAuth();
  const params = useLocalSearchParams();
  const [message, setMessage] = useState("");
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following'>('followers');

  // Use the URL param username if available, otherwise use current user's username
  const profileUsername = (params.username as string) || currentUsername;

  const { hiveAccount, isLoading: isLoadingProfile, error } = useHiveAccount(profileUsername);
  const {
    posts: userPosts,
    isLoading: isLoadingPosts,
    loadNextPage,
    hasMore,
    refresh: refreshPosts,
  } = useUserComments(profileUsername);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
      setMessage("Error logging out");
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
  const renderProfileHeader = () => (
    <View>
      {/* Cover Image */}
      <View style={styles.coverImageContainer}>
        {hiveAccount?.metadata?.profile?.cover_image ? (
          <Image
            source={{ uri: hiveAccount.metadata.profile.cover_image }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.defaultCoverImage} />
        )}
      </View>

      {/* Profile Section - Overlapping the cover */}
      <View style={styles.profileSection}>
        {/* Top-right logout button (only for owner) */}
        {!params.username && (
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <View style={styles.logoutButtonContent}>
              <Text style={styles.logoutButtonText}>Logout</Text>
              <Ionicons name="exit-outline" size={16} color={theme.colors.text} />
            </View>
          </Pressable>
        )}

        {/* Profile Picture and Name Section */}
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileImageContainer}>
            {renderProfileImage()}
          </View>
          
          {/* Name and Username beside profile pic */}
          <View style={styles.nameSection}>
            <Text style={styles.profileName}>
              {hiveAccount?.metadata?.profile?.name || hiveAccount?.name || profileUsername}
            </Text>
            <Text style={styles.username}>@{profileUsername}</Text>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>

          {/* Bio */}
          {hiveAccount?.metadata?.profile?.about && (
            <Text style={styles.aboutText}>
              {hiveAccount.metadata.profile.about}
            </Text>
          )}

          {/* Location and Website */}
          <View style={styles.metaInfo}>
            {hiveAccount?.metadata?.profile?.location && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>📍</Text>
                <Text style={styles.metaText}>{hiveAccount.metadata.profile.location}</Text>
              </View>
            )}
            {hiveAccount?.metadata?.profile?.website && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>🌐</Text>
                <Text style={styles.metaText}>{hiveAccount.metadata.profile.website}</Text>
              </View>
            )}
          </View>

          {/* Stats Row */}
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
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vp.toFixed(0)}%</Text>
              <Text style={styles.statLabel}>VP</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Show Create Account CTA only for SPECTATOR */}
      {profileUsername === "SPECTATOR" && <ProfileSpectatorInfo />}
      
      {/* Add spacing before posts section */}
      {profileUsername !== "SPECTATOR" && <View style={styles.postsSpacing} />}
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
      ) : (
        <FlatList
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
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={7}
        />
      )}

      {/* Followers/Following Modal */}
      {profileUsername !== "SPECTATOR" && (
        <FollowersModal
          visible={followersModalVisible}
          onClose={() => setFollowersModalVisible(false)}
          username={profileUsername || ''}
          type={modalType}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Cover Image Styles
  coverImageContainer: {
    height: 120,
    width: '100%',
    backgroundColor: theme.colors.card,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  defaultCoverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Profile Section Styles
  profileSection: {
    position: 'relative',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    marginTop: -12, // Overlap the cover image
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center', // Center align items vertically
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  profileImageContainer: {
    // No need for alignSelf since it's in a row now
  },
  logoutButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 10,
  },
  logoutButtonContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  logoutButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  profileInfo: {
    gap: theme.spacing.sm,
  },
  nameSection: {
    flex: 1,
    gap: theme.spacing.xxs,
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
  aboutText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.fontSizes.sm * 1.4,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaIcon: {
    fontSize: theme.fontSizes.xs,
  },
  metaText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
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
  // Legacy styles for backward compatibility
  exitButton: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 10,
  },
  exitButtonContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  exitButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
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
  postsSpacing: {
    height: theme.spacing.lg,
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
