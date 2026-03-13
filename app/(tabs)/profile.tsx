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
  Modal,
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
import { theme } from "~/lib/theme";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { useUserComments } from "~/lib/hooks/useUserComments";

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
  const { username: currentUsername, logout } = useAuth();
  const params = useLocalSearchParams();
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following' | 'muted'>('followers');

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

            {/* Username */}
            <Text style={styles.username}>@{profileUsername}</Text>

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
