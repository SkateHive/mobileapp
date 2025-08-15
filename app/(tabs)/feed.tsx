import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { Feed } from "~/components/Feed/Feed";
import { theme } from "~/lib/theme";

export default function FeedPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey((prev) => prev + 1);
    }, [])
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

  return (
    <View style={styles.container}>
      <Feed refreshTrigger={refreshKey} />
    </View>
  );
}
