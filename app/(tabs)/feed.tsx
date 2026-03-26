import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { Feed } from "~/components/Feed/Feed";
import { theme } from "~/lib/theme";
import { useNotifications } from "~/lib/hooks/useNotifications";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default function FeedPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { refresh: refreshNotifications } = useNotifications();

  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey((prev) => prev + 1);
    }, [])
  );

  const handleFeedRefresh = React.useCallback(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  return (
    <View style={styles.container}>
      <Feed refreshTrigger={refreshKey} onRefresh={handleFeedRefresh} />
    </View>
  );
}
