import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { Text } from "~/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "~/lib/auth-provider";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { RewardsSpectatorInfo } from "~/components/SpectatorMode/RewardsSpectatorInfo";
import { useMarket } from "~/lib/hooks/useQueries";
import { useBlockchainWallet } from "~/lib/hooks/useBlockchainWallet";
import { theme } from "~/lib/theme";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAppSettings } from "~/lib/AppSettingsContext";
import { Switch } from "react-native";

function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useAuth();
  const { balanceData, rewardsData, isLoading, error, refresh } = useBlockchainWallet(username);
  const [showWallet, setShowWallet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: marketData } = useMarket();
  const { settings, updateSettings } = useAppSettings();

  const isAdvanced = settings.isAdvancedWallet;

  const toggleWalletMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings({ isAdvancedWallet: !isAdvanced });
  };

  // Handle pull-to-refresh
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const calculateTotalValue = () => {
    if (!balanceData || !rewardsData || !marketData) return "0.00";

    // HBD is 1:1 with USD
    const liquidHbd = parseFloat(balanceData.hbd) || 0;
    const savingsHbd = parseFloat(balanceData.hbd_savings) || 0;
    const claimableHbd = parseFloat(balanceData.hbd_claimable) || 0;
    const hbdTotalValue = liquidHbd + savingsHbd + claimableHbd;

    // Convert HIVE to USD using market price
    const hivePrice = parseFloat(marketData.close) || 0;
    const liquidHive = parseFloat(balanceData.hive) || 0;
    const savingsHive = parseFloat(balanceData.hive_savings) || 0;
    const hpEquivalent = parseFloat(balanceData.hp_equivalent) || 0;
    
    const hiveTotalValue = (liquidHive + savingsHive + hpEquivalent) * hivePrice;

    // Pending rewards in HBD (post payouts)
    const pendingValue =
      parseFloat(rewardsData.summary.total_pending_payout) || 0;

    return (hiveTotalValue + hbdTotalValue + pendingValue).toFixed(2);
  };

  const hideValue = (value: string | number | undefined) => {
    return !showWallet ? "•••" : value?.toString() || "0";
  };

  const sortedPendingPosts = (posts: any[]) => {
    return [...posts].sort((a, b) => {
      const aTimeLeft =
        a.remaining_till_cashout.days * 24 * 60 +
        a.remaining_till_cashout.hours * 60 +
        a.remaining_till_cashout.minutes;
      const bTimeLeft =
        b.remaining_till_cashout.days * 24 * 60 +
        b.remaining_till_cashout.hours * 60 +
        b.remaining_till_cashout.minutes;
      return aTimeLeft - bTimeLeft;
    });
  };

  const formatTimeLeft = (time: {
    days: number;
    hours: number;
    minutes: number;
  }) => {
    const parts = [];
    if (time.days || time.days === 0) parts.push(`${time.days}d`);
    if (time.hours || time.hours === 0) parts.push(`${time.hours}h`);
    if (time.minutes || time.minutes === 0) parts.push(`${time.minutes}m`);
    return parts.join(" ") || "0m";
  };

  const calculateDollarValue = (
    amount: string | undefined,
    price: string | undefined
  ) => {
    if (!amount || !price) return "0.00";
    return (parseFloat(amount) * parseFloat(price)).toFixed(2);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: insets.top }]}>
        <Text style={styles.topHeaderTitle}>My Wallet</Text>
        <View style={styles.headerRight}>
          <Pressable 
            onPress={toggleWalletMode}
            style={[styles.modeToggle, isAdvanced && styles.modeToggleActive]}
          >
            <Text style={[styles.modeToggleText, isAdvanced && styles.modeToggleTextActive]}>
              {isAdvanced ? "ADVANCED" : "BASIC"}
            </Text>
          </Pressable>
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {username === "SPECTATOR" ? (
          <RewardsSpectatorInfo />
        ) : (
          <View style={styles.content}>
            {/* Account Overview Header */}
            <View style={styles.overviewHeader}>
              <View>
                <Text style={styles.overviewLabel}>Total Estimated Value</Text>
                <Text style={styles.overviewValue}>${hideValue(calculateTotalValue())}</Text>
              </View>
              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowWallet(!showWallet);
                }}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showWallet ? "eye-outline" : "eye-off-outline"}
                  size={24}
                  color={theme.colors.muted}
                />
              </Pressable>
            </View>

            {!isAdvanced ? (
              /* BASIC VIEW */
              <View style={styles.basicContainer}>
                {/* Basic HIVE */}
                <View style={styles.basicTokenCard}>
                  <View style={styles.tokenInfo}>
                    <View style={[styles.tokenIcon, { backgroundColor: '#E3133720' }]}>
                      <Ionicons name="logo-bitcoin" size={20} color="#E31337" />
                    </View>
                    <Text style={styles.tokenName}>HIVE Balance</Text>
                  </View>
                  <Text style={styles.tokenBalance}>{hideValue(balanceData?.hive)}</Text>
                  <Pressable style={[styles.actionButton, { marginTop: theme.spacing.md }]}>
                    <Ionicons name="send-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.actionButtonText}>SEND HIVE</Text>
                  </Pressable>
                </View>

                {/* Basic HBD */}
                <View style={styles.basicTokenCard}>
                  <View style={styles.tokenInfo}>
                    <View style={[styles.tokenIcon, { backgroundColor: '#00BA9520' }]}>
                      <Ionicons name="cash-outline" size={20} color="#00BA95" />
                    </View>
                    <Text style={styles.tokenName}>HBD Balance</Text>
                  </View>
                  <Text style={styles.tokenBalance}>{hideValue(balanceData?.hbd)}</Text>
                  <Pressable style={[styles.actionButton, { marginTop: theme.spacing.md, backgroundColor: '#333' }]}>
                    <Ionicons name="send-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.actionButtonText}>SEND HBD</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ADVANCED VIEW (Original) */
              <>
                {/* HIVE Section */}
                <View style={styles.tokenSection}>
                  <View style={styles.tokenHeader}>
                    <View style={styles.tokenInfo}>
                      <View style={[styles.tokenIcon, { backgroundColor: '#E3133720' }]}>
                        <Ionicons name="logo-bitcoin" size={20} color="#E31337" />
                      </View>
                      <Text style={styles.tokenName}>HIVE</Text>
                    </View>
                    <Text style={styles.tokenBalance}>{hideValue(balanceData?.hive)}</Text>
                  </View>
                  <Text style={styles.tokenDescription}>
                    The primary token of the Hive Blockchain and often a reward on posts.
                  </Text>
                  
                  <View style={styles.tokenActions}>
                    <Pressable style={styles.actionButton}>
                      <Ionicons name="send-outline" size={16} color={theme.colors.text} />
                      <Text style={styles.actionButtonText}>SEND</Text>
                    </Pressable>
                    <Pressable style={styles.actionButtonSecondary}>
                      <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
                    </Pressable>
                  </View>

                  <View style={styles.detailList}>
                    <View style={styles.detailItem}>
                      <View style={styles.detailBullet} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailLabel}>Staked HIVE - Hive Power (HP)</Text>
                          <Text style={styles.detailValue}>{hideValue(balanceData?.hp_equivalent)}</Text>
                        </View>
                        <Text style={styles.detailSubtext}>
                          Increases the more effectively you vote on posts.
                        </Text>
                        <View style={styles.actionRow}>
                          <Pressable style={styles.smallActionButton}>
                            <Ionicons name="arrow-down-outline" size={14} color={theme.colors.text} />
                            <Text style={styles.smallActionText}>UNSTAKE</Text>
                          </Pressable>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>~4.37 - 14% APR</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={styles.detailBullet} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailLabel}>Delegated HIVE</Text>
                          <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
                            +{hideValue(balanceData?.received_hp)}
                          </Text>
                        </View>
                        <Text style={styles.detailSubtext}>HP delegated to you from other users.</Text>
                      </View>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={styles.detailBullet} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailLabel}>HIVE Savings</Text>
                          <Text style={styles.detailValue}>{hideValue(balanceData?.hive_savings)}</Text>
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable style={styles.smallActionButton}>
                            <Ionicons name="download-outline" size={14} color={theme.colors.text} />
                            <Text style={styles.smallActionText}>WITHDRAW</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* HBD Section */}
                <View style={styles.tokenSection}>
                  <View style={styles.tokenHeader}>
                    <View style={styles.tokenInfo}>
                      <View style={[styles.tokenIcon, { backgroundColor: '#00BA9520' }]}>
                        <Ionicons name="cash-outline" size={20} color="#00BA95" />
                      </View>
                      <Text style={styles.tokenName}>HBD (Hive Backed Dollars)</Text>
                    </View>
                    <Text style={styles.tokenBalance}>{hideValue(balanceData?.hbd)}</Text>
                  </View>
                  <Text style={styles.tokenDescription}>
                    Another Hive token which is often rewarded on posts.
                  </Text>

                  <View style={styles.tokenActions}>
                    <Pressable style={styles.actionButton}>
                      <Ionicons name="cart-outline" size={16} color={theme.colors.text} />
                      <Text style={styles.actionButtonText}>MARKET</Text>
                    </Pressable>
                    <Pressable style={styles.actionButtonSecondary}>
                      <Ionicons name="chevron-down" size={16} color={theme.colors.muted} />
                    </Pressable>
                  </View>

                  <View style={[styles.detailList, { borderLeftColor: '#00BA95' }]}>
                    <View style={styles.detailItem}>
                      <View style={[styles.detailBullet, { backgroundColor: '#00BA95' }]} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailLabel}>Staked HBD (Savings)</Text>
                          <Text style={styles.detailValue}>{hideValue(balanceData?.hbd_savings)}</Text>
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable style={styles.smallActionButton}>
                            <Ionicons name="arrow-up-outline" size={14} color={theme.colors.text} />
                            <Text style={styles.smallActionText}>UNSTAKE</Text>
                          </Pressable>
                          <View style={[styles.badge, { backgroundColor: '#00BA9520' }]}>
                            <Text style={[styles.badgeText, { color: '#00BA95' }]}>14.00% APR</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={[styles.detailBullet, { backgroundColor: '#00BA95' }]} />
                      <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                          <Text style={styles.detailLabel}>Staked HBD - Claimable</Text>
                          <Text style={[styles.detailValue, { color: '#00BA95' }]}>
                            {hideValue(balanceData?.hbd_claimable)}
                          </Text>
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable style={[styles.smallActionButton, { backgroundColor: '#00BA9520' }]}>
                            <Text style={[styles.smallActionText, { color: '#00BA95' }]}>CLAIM NOW</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Potential Rewards Card */}
                {rewardsData && (
                  <View style={styles.rewardsCard}>
                    <View style={styles.rewardsIconContainer}>
                      <Ionicons name="stats-chart" size={24} color={theme.colors.text} />
                    </View>
                    <View style={styles.rewardsContent}>
                      <Text style={styles.rewardsLabel}>
                        Potential Rewards: <Text style={styles.rewardsHighlights}>{hideValue(rewardsData.summary.pending_hp)} HP, {hideValue(rewardsData.summary.pending_hbd)} HBD</Text>
                      </Text>
                      <Text style={styles.rewardsSubtext}>Estimated for the next 7 days</Text>
                    </View>
                  </View>
                )}

                {/* Active Posts Card */}
                {rewardsData?.pending_posts && rewardsData.pending_posts.length > 0 && (
                  <View style={styles.postsSection}>
                    <Text style={styles.sectionTitle}>Active Posts</Text>
                    {sortedPendingPosts(rewardsData.pending_posts).map((post, index) => (
                      <View key={index} style={styles.postCard}>
                        <Text style={styles.postTitle} numberOfLines={1}>{post.title || "Comment"}</Text>
                        <View style={styles.postMeta}>
                          <Text style={styles.postValue}>${hideValue(post.pending_payout_value)}</Text>
                          <Text style={styles.postTime}>{formatTimeLeft(post.remaining_till_cashout)} left</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  topHeaderTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modeToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#333',
  },
  modeToggleActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  modeToggleText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
  },
  modeToggleTextActive: {
    color: theme.colors.primary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  basicContainer: {
    gap: theme.spacing.lg,
  },
  basicTokenCard: {
    backgroundColor: '#1A1A1A',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#333',
    gap: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#333',
  },
  overviewLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: theme.fontSizes.xxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  eyeButton: {
    padding: theme.spacing.sm,
  },
  tokenSection: {
    gap: theme.spacing.md,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenName: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  tokenBalance: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  tokenDescription: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    lineHeight: 20,
    fontFamily: theme.fonts.regular,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    gap: 8,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  actionButtonSecondary: {
    width: 44,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  detailList: {
    marginLeft: 18,
    borderLeftWidth: 2,
    borderLeftColor: '#E31337',
    paddingLeft: theme.spacing.sm,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  detailBullet: {
    width: 12,
    height: 2,
    backgroundColor: '#E31337',
    marginTop: 10,
  },
  detailContent: {
    flex: 1,
    gap: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  detailValue: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  detailSubtext: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 6,
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },
  smallActionText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: '#E3133720',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    color: '#E31337',
    fontFamily: theme.fonts.bold,
  },
  rewardsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#333',
  },
  rewardsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsContent: {
    flex: 1,
  },
  rewardsLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  rewardsHighlights: {
    fontFamily: theme.fonts.bold,
  },
  rewardsSubtext: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
  },
  postsSection: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  postCard: {
    backgroundColor: '#1A1A1A',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 4,
  },
  postTitle: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postValue: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
  },
  postTime: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
  },
});

export default WalletScreen;
