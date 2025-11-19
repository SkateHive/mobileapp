import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { Text } from "~/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "~/lib/auth-provider";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { RewardsSpectatorInfo } from "~/components/SpectatorMode/RewardsSpectatorInfo";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { useMarket } from "~/lib/hooks/useQueries";
import { useBlockchainWallet } from "~/lib/hooks/useBlockchainWallet";
import { theme } from "~/lib/theme";

export default function WalletScreen() {
  const { username } = useAuth();
  const { balanceData, rewardsData, isLoading, error, refresh } = useBlockchainWallet(username);
  const [showWallet, setShowWallet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: marketData } = useMarket();

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
    const hbdValue = parseFloat(balanceData.hbd) || 0;

    // Convert HIVE to USD using market price
    const hivePrice = parseFloat(marketData.close) || 0;
    const hiveValue = (parseFloat(balanceData.hive) || 0) * hivePrice;
    const hpValue = (parseFloat(balanceData.hp_equivalent) || 0) * hivePrice;

    // Pending rewards in HBD
    const pendingValue =
      parseFloat(rewardsData.summary.total_pending_payout) || 0;

    return (hiveValue + hbdValue + hpValue + pendingValue).toFixed(2);
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
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={isRefreshing} 
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          title="Pull to refresh..."
          titleColor={theme.colors.text}
        />
      }
    >
      {username === "SPECTATOR" ? (
        <RewardsSpectatorInfo />
      ) : (
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="wallet-outline"
                size={48}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.headerTitle}>Wallet</Text>
          </View>

          {/* Account Overview Card */}
          <Card style={styles.card}>
            <CardHeader style={styles.cardHeader}>
              <CardTitle style={styles.cardTitle}>Account Overview</CardTitle>
              <Pressable onPress={() => setShowWallet(!showWallet)}>
                <Ionicons
                  name={showWallet ? "eye-outline" : "eye-off-outline"}
                  size={24}
                  color={theme.colors.text}
                />
              </Pressable>
            </CardHeader>
            <CardContent style={styles.cardContentContainer}>
              <View style={styles.cardContent}>
                <View style={styles.totalValueRow}>
                  <Text style={styles.mutedText}>Total Value</Text>
                  <Text style={styles.totalValueText}>
                    {hideValue(calculateTotalValue())}
                  </Text>
                </View>

                <View style={styles.balanceSection}>
                  <View style={styles.balanceItem}>
                    <View style={styles.balanceRow}>
                      <Text style={styles.mutedText}>HBD</Text>
                      <View style={styles.balanceValues}>
                        <Text style={styles.balanceAmount}>
                          {hideValue(balanceData?.hbd)}
                        </Text>
                        <Text style={styles.balanceUsd}>
                          {hideValue(balanceData?.hbd)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={styles.balanceRow}>
                      <Text style={styles.mutedText}>HIVE</Text>
                      <View style={styles.balanceValues}>
                        <Text style={styles.balanceAmount}>
                          {hideValue(balanceData?.hive)}
                        </Text>
                        <Text style={styles.balanceUsd}>
                          {hideValue(
                            calculateDollarValue(
                              balanceData?.hive,
                              marketData?.close
                            )
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.balanceItem}>
                    <View style={styles.balanceRow}>
                      <Text style={styles.mutedText}>Hive Power</Text>
                      <View style={styles.balanceValues}>
                        <Text style={styles.balanceAmount}>
                          {hideValue(balanceData?.hp_equivalent)}
                        </Text>
                        <Text style={styles.balanceUsd}>
                          {hideValue(
                            calculateDollarValue(
                              balanceData?.hp_equivalent,
                              marketData?.close
                            )
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Pending Rewards Card */}
          {rewardsData && (
            <Card style={styles.card}>
              <CardHeader>
                <CardTitle style={styles.cardTitle}>Pending Rewards</CardTitle>
              </CardHeader>
              <CardContent style={styles.cardContentContainer}>
                <View style={styles.cardContent}>
                  <View style={styles.totalValueRow}>
                    <Text style={styles.mutedText}>Total Pending</Text>
                    <Text style={styles.pendingRewardsText}>
                      {hideValue(rewardsData.summary.total_pending_payout)} HBD
                    </Text>
                  </View>

                  <View style={styles.rewardsSection}>
                    <View style={styles.rewardsRow}>
                      <Text style={styles.mutedText}>
                        Active Posts
                      </Text>
                      <Text style={styles.rewardsValue}>
                        {hideValue(rewardsData.summary.pending_posts_count)}
                      </Text>
                    </View>

                    <View style={styles.rewardsRow}>
                      <Text style={styles.mutedText}>
                        Author Rewards
                      </Text>
                      <Text style={styles.rewardsValue}>
                        {hideValue(rewardsData.summary.total_author_rewards)}
                      </Text>
                    </View>

                    <View style={styles.rewardsRow}>
                      <Text style={styles.mutedText}>
                        Curator Rewards
                      </Text>
                      <Text style={styles.rewardsValue}>
                        {hideValue(rewardsData.summary.total_curator_payouts)}
                      </Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* Active Posts Card */}
          {rewardsData &&
            rewardsData.pending_posts &&
            rewardsData.pending_posts.length > 0 && (
              <Card style={styles.card}>
                <CardHeader>
                  <CardTitle style={styles.cardTitle}>Active Posts</CardTitle>
                </CardHeader>
                <CardContent style={styles.cardContentContainer}>
                  <View style={styles.cardContent}>
                    {sortedPendingPosts(rewardsData.pending_posts).map(
                      (post, index) => (
                        <View
                          key={index}
                          style={[
                            styles.postItem,
                            index !== rewardsData.pending_posts.length - 1 && styles.postItemBorder
                          ]}
                        >
                          <View style={styles.postContent}>
                            <Text style={styles.postTitle}>
                              {post.title || "Comment"}
                            </Text>
                            <View style={styles.postRow}>
                              <Text style={styles.mutedText}>
                                Potential
                              </Text>
                              <Text style={styles.pendingRewardsText}>
                                {hideValue(post.pending_payout_value)}
                              </Text>
                            </View>
                            <View style={styles.postRow}>
                              <Text style={styles.mutedText}>
                                Time Left
                              </Text>
                              <Text style={styles.timeLeftText}>
                                {formatTimeLeft(post.remaining_till_cashout)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )
                    )}
                  </View>
                </CardContent>
              </Card>
            )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  content: {
    flex: 1,
    gap: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xxxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    lineHeight: theme.fontSizes.xxxl + theme.spacing.sm,
  },
  // Card component overrides
  card: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    shadowColor: 'transparent',
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingBottom: 0,
  },
  cardTitle: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    lineHeight: theme.fontSizes.xl + theme.spacing.xs,
  },
  cardContentContainer: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  cardContent: {
    gap: theme.spacing.md,
  },
  totalValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalValueText: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  mutedText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
  },
  balanceSection: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  balanceItem: {
    gap: theme.spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceValues: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  balanceUsd: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  pendingRewardsText: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  rewardsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  rewardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardsValue: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  postItem: {
    paddingBottom: theme.spacing.sm,
  },
  postItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  postContent: {
    gap: theme.spacing.xs,
  },
  postTitle: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  postRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLeftText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
});
