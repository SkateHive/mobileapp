import React, { useMemo } from "react";
import { View, Image, ScrollView, StyleSheet } from "react-native";
import { Text } from "~/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { Crown } from "lucide-react-native";
import { useLeaderboard } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";

interface LeaderboardProps {
  currentUsername: string | null;
}

interface LeaderboardUserInfo {
  position: number;
  id: number;
  hive_author: string;
  points: number;
}

export function Leaderboard({ currentUsername }: LeaderboardProps) {
  const { data: leaderboardData, isLoading, error } = useLeaderboard();

  const { topSkaters, surroundingUsers, currentUserInfo } = useMemo(() => {
    if (!leaderboardData)
      return { topSkaters: [], surroundingUsers: [], currentUserInfo: null };

    // Updated the map and filter functions to include explicit type annotations for parameters
    const top10 = leaderboardData.slice(0, 10).map((user, index: number) => ({
      position: index + 1,
      id: user.id,
      hive_author: user.hive_author,
      points: user.points,
    }));

    let surroundingUsers: LeaderboardUserInfo[] = [];
    let currentUserInfo = null;

    if (currentUsername) {
          const currentUserIndex = leaderboardData.findIndex(
        (user) => user.hive_author === currentUsername
      );

      if (currentUserIndex !== -1) {
        currentUserInfo = {
          position: currentUserIndex + 1,
          id: leaderboardData[currentUserIndex].id,
          hive_author: leaderboardData[currentUserIndex].hive_author,
          points: leaderboardData[currentUserIndex].points,
        };

        if (currentUserIndex > 9) {
          const startIndex = currentUserIndex > 14 ? currentUserIndex - 5 : 10;
          const endIndex = Math.min(currentUserIndex + 5, leaderboardData.length - 1);

          surroundingUsers = leaderboardData
            .slice(startIndex, endIndex + 1)
            .map((user, idx: number) => ({
              position: startIndex + idx + 1,
              id: user.id,
              hive_author: user.hive_author,
              points: user.points,
            }))
            .filter((user: LeaderboardUserInfo) => user.hive_author !== currentUsername); // Removendo duplicata do usuário atual

          surroundingUsers = [...surroundingUsers, currentUserInfo].sort(
            (a, b) => a.position - b.position
          );
        }
      }
    }

    return { topSkaters: top10, surroundingUsers, currentUserInfo };
  }, [leaderboardData, currentUsername]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading leaderboard</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="podium-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Leaderboard</Text>
        </View>

        <View style={styles.listContainer}>
          {topSkaters.map((skater: LeaderboardUserInfo, index: number) => (
            <LeaderboardItem
              key={skater.id}
              skater={skater}
              isTop={index < 3}
              isCurrentUser={skater.hive_author === currentUsername}
            />
          ))}

          {currentUserInfo && surroundingUsers.length > 0 && (
            <>
              {surroundingUsers.map((skater) => (
                <LeaderboardItem
                  key={skater.id}
                  skater={skater}
                  isCurrentUser={skater.hive_author === currentUsername}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const LeaderboardItem = ({
  skater,
  isTop = false,
  isCurrentUser = false,
}: {
  skater: LeaderboardUserInfo;
  isTop?: boolean;
  isCurrentUser?: boolean;
}) => {
  const itemStyle = [
    styles.itemContainer,
    isTop && styles.topItemContainer,
    isCurrentUser && styles.currentUserContainer,
  ];

  const positionStyle = [
    styles.positionText,
    isTop ? styles.topPositionText : styles.regularPositionText,
  ];

  const usernameStyle = [
    styles.usernameText,
    isTop ? styles.topUsernameText : styles.regularUsernameText,
  ];

  const pointsStyle = [
    styles.pointsText,
    isTop ? styles.topPointsText : styles.regularPointsText,
  ];

  return (
    <View style={itemStyle}>
      <Text style={positionStyle}>
        #{skater.position}
      </Text>

      <View style={styles.avatarContainer}>
        <Image
          source={{
            uri: `https://images.hive.blog/u/${skater.hive_author}/avatar/small`,
          }}
          style={styles.avatar}
        />
        {isTop && skater.position === 1 && (
          <View style={styles.crownContainer}>
            <Crown size={18} color="#FFCC00" strokeWidth={2} />
          </View>
        )}
      </View>

      <Text style={usernameStyle}>
        {skater.hive_author}
      </Text>
      <Text style={pointsStyle}>
        {skater.points.toFixed(0)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    width: '100%',
    paddingVertical: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSizes.xxxl,
    fontWeight: 'bold',
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    paddingTop: theme.spacing.sm, // Add padding to prevent cutoff
    lineHeight: 40, // Ensure proper line height
  },
  listContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xxs,
  },
  topItemContainer: {
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  currentUserContainer: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.spacing.sm,
  },
  positionText: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    width: 50,
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
  },
  topPositionText: {
    color: '#d4af37', // Gold color for top positions
  },
  regularPositionText: {
    color: '#eeeeee',
  },
  avatarContainer: {
    height: 48,
    width: 48,
    marginRight: theme.spacing.sm,
    borderRadius: 24,
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  crownContainer: {
    position: 'absolute',
    top: -16,
    left: '50%',
    marginLeft: -9, // Half of crown width to center it
  },
  usernameText: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    paddingLeft: theme.spacing.sm + theme.spacing.xs,
    flex: 1,
    textAlign: 'left',
    fontFamily: theme.fonts.bold,
  },
  topUsernameText: {
    color: theme.colors.white,
  },
  regularUsernameText: {
    color: '#eeeeee',
  },
  pointsText: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
  topPointsText: {
    color: theme.colors.primary,
  },
  regularPointsText: {
    color: theme.colors.white,
  },
});
