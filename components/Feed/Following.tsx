import React from "react";
import { Animated, FlatList, RefreshControl, View, StyleSheet } from "react-native";
import { useAuth } from "~/lib/auth-provider";
import type { Post } from "~/lib/types";
import { PostCard } from "./PostCard";
import { Text } from "../ui/text";
import { LoadingScreen } from "../ui/LoadingScreen";
import { useFollowing} from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";

interface FollowingProps {
  refreshTrigger?: number;
}

export function Following({ refreshTrigger = 0 }: FollowingProps) {
  const [newPosts, setNewPosts] = React.useState<Post[]>([]);
  const { username } = useAuth();
  const notificationOpacity = React.useRef(new Animated.Value(0)).current;
  const { data: feedData, isLoading, refetch, isRefetching } = useFollowing(username || "SPECTATOR");

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => (
      <PostCard key={item.permlink} post={item as any} currentUsername={username} />
    ),
    [username]
  );

  const keyExtractor = React.useCallback((item: Post) => item.permlink, []);

  const ListHeaderComponent = React.useCallback(
    () => <Text style={styles.headerText}>Following Posts</Text>,
    []
  );

  const ItemSeparatorComponent = React.useCallback(
    () => <View style={styles.separator} />,
    []
  );

  const foregroundColor = theme.colors.text;
  const backgroundColor = theme.colors.background;

  const contentView = (
    <View style={styles.container}>
      <FlatList
        data={feedData}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={foregroundColor}
            colors={[foregroundColor]}
            progressBackgroundColor={backgroundColor}
          />
        }
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={7}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );

  return isLoading ? <LoadingScreen /> : contentView;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerText: {
    fontSize: 24,
    fontFamily: theme.fonts.bold,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.text,
  },
  separator: {
    height: 0,
    marginVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});
