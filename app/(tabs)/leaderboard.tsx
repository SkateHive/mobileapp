import React from "react";
import { View, StyleSheet } from "react-native";
import { Leaderboard } from "~/components/Leaderboard/leaderboard";
import { useAuth } from "~/lib/auth-provider";
import { theme } from "~/lib/theme";

export default function LeaderboardScreen() {
  const { username } = useAuth();

  return (
    <View style={styles.container}>
      <Leaderboard currentUsername={username} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    width: '100%',
    height: '100%',
  },
});
