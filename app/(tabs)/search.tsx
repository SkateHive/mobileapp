import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  View, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  Pressable, 
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Keyboard
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSearch, SearchType, TimeFilter } from "~/lib/hooks/useSearch";
import { PostCard } from "~/components/Feed/PostCard";
import { ConversationDrawer } from "~/components/Feed/ConversationDrawer";
import { useAuth } from "~/lib/auth-provider";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { Discussion } from "@hiveio/dhive";
import { 
  getRecentSearches, 
  saveRecentSearch, 
  removeRecentSearch, 
  clearRecentSearches 
} from "~/lib/search-utils";

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SearchScreen() {
  const router = useRouter();
  const { username: currentUsername } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [conversationPost, setConversationPost] = useState<Discussion | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    loadRecents();
  }, [currentUsername]);

  const loadRecents = async () => {
    const list = await getRecentSearches(currentUsername);
    setRecentSearches(list);
  };

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Save search to recents when query is confirmed (debounced query changes)
  useEffect(() => {
    if (debouncedQuery.trim().length > 2) {
      handleSearchSubmit(debouncedQuery);
    }
  }, [debouncedQuery, currentUsername]);

  // Auto-switch to Skaters tab if query starts with @
  useEffect(() => {
    if (searchQuery.startsWith("@") && searchType !== 'users') {
      setSearchType('users');
    }
  }, [searchQuery]);

  const handleSearchSubmit = async (queryToSave: string) => {
    if (queryToSave.trim()) {
      const updated = await saveRecentSearch(currentUsername, queryToSave);
      setRecentSearches(updated || []);
    }
  };

  const {
    users,
    snaps,
    isLoading,
    isSnapsFetchingNextPage,
    loadMoreSnaps,
    hasMoreSnaps,
  } = useSearch(debouncedQuery, searchType, "1y"); // Using 1y as default

  const handleOpenConversation = useCallback((post: Discussion) => {
    setConversationPost(post);
  }, []);

  const handleCloseConversation = useCallback(() => {
    setConversationPost(null);
  }, []);

  const handleRemoveRecent = async (query: string) => {
    const updated = await removeRecentSearch(currentUsername, query);
    setRecentSearches(updated);
  };

  const handleGoBack = () => {
    if (searchQuery.length > 0) {
      setSearchQuery("");
      setDebouncedQuery("");
    } else {
      router.back();
    }
  };

  const renderRecentItem = ({ item }: { item: string }) => (
    <View style={styles.recentItemContainer}>
      <Pressable 
        style={styles.recentItem} 
        onPress={() => {
          setSearchQuery(item);
          setDebouncedQuery(item);
          Keyboard.dismiss();
        }}
      >
        <Ionicons name="time-outline" size={24} color={theme.colors.muted} />
        <Text style={styles.recentItemText}>{item}</Text>
      </Pressable>
      <Pressable onPress={() => handleRemoveRecent(item)} style={styles.removeRecentButton}>
        <Ionicons name="close" size={20} color={theme.colors.muted} />
      </Pressable>
    </View>
  );

  const renderVerticalUser = ({ item }: { item: any }) => (
    <Pressable 
      style={styles.userItem}
      onPress={() => router.push({ pathname: "/(tabs)/profile", params: { username: item.name } })}
    >
      <Image
        source={{ uri: `https://images.hive.blog/u/${item.name}/avatar/small` }}
        style={styles.userAvatar}
        transition={200}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>@{item.name}</Text>
        <Text style={styles.userFollowers}>{item.followers} followers</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
    </Pressable>
  );

  const renderSnapItem = ({ item }: { item: any }) => (
    <PostCard
      post={item}
      currentUsername={currentUsername || ""}
      onOpenConversation={handleOpenConversation}
    />
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    if (!debouncedQuery) {
      if (recentSearches.length > 0) {
        return (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent</Text>
              <Pressable onPress={() => clearRecentSearches(currentUsername).then(setRecentSearches)}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </Pressable>
            </View>
            <FlatList
              data={recentSearches}
              renderItem={renderRecentItem}
              keyExtractor={(item) => item}
              scrollEnabled={false}
            />
          </View>
        );
      }
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="search-outline" size={64} color={theme.colors.border} />
          <Text style={styles.emptyMessage}>Search for Skaters and Snaps</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContent}>
        <Ionicons name="sad-outline" size={64} color={theme.colors.border} />
        <Text style={styles.emptyMessage}>No results found for "{debouncedQuery}"</Text>
      </View>
    );
  };

  const renderHeaderResults = () => {
    if (searchType === 'all' && users.length > 0) {
      return (
        <View style={styles.allViewHeader}>
          <Text style={styles.sectionTitle}>Skaters</Text>
          {users.slice(0, 3).map((user: any) => (
            <Pressable 
              key={user.name}
              style={styles.userItem}
              onPress={() => router.push({ pathname: "/(tabs)/profile", params: { username: user.name } })}
            >
              <Image
                source={{ uri: `https://images.hive.blog/u/${user.name}/avatar/small` }}
                style={styles.userAvatar}
                transition={200}
              />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>@{user.name}</Text>
                <Text style={styles.userFollowers}>{user.followers} followers</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
            </Pressable>
          ))}
          {snaps.length > 0 && <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg, marginBottom: theme.spacing.md }]}>Snaps</Text>}
        </View>
      );
    }
    return null;
  };

  const onEndReached = () => {
    if (hasMoreSnaps && !isSnapsFetchingNextPage) {
      loadMoreSnaps();
    }
  };

  const renderFooter = () => {
    if (isSnapsFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    return <View style={{ height: 120 }} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.searchHeader}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.searchBar}>
            <TextInput
              placeholder="Search..."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
              returnKeyType="search"
              onSubmitEditing={() => handleSearchSubmit(searchQuery)}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={styles.clearIcon}>
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {debouncedQuery.length > 0 && (
          <View style={styles.tabsRow}>
            <Pressable 
              style={[styles.tab, searchType === 'all' && styles.activeTab]}
              onPress={() => setSearchType('all')}
            >
              <Text style={[styles.tabText, searchType === 'all' && styles.activeTabText]}>For you</Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, searchType === 'users' && styles.activeTab]}
              onPress={() => setSearchType('users')}
            >
              <Text style={[styles.tabText, searchType === 'users' && styles.activeTabText]}>Accounts</Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, searchType === 'snaps' && styles.activeTab]}
              onPress={() => setSearchType('snaps')}
            >
              <Text style={[styles.tabText, searchType === 'snaps' && styles.activeTabText]}>Snaps</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.resultsContainer}>
        {isLoading && snaps.length === 0 && users.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          searchType === 'users' ? (
            <FlatList
              data={users}
              renderItem={renderVerticalUser}
              keyExtractor={(item) => item.name}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              data={snaps}
              renderItem={renderSnapItem}
              keyExtractor={(item) => item.permlink}
              ListHeaderComponent={renderHeaderResults}
              ListEmptyComponent={renderEmptyState}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )
        )}
      </View>

      {/* Shared conversation drawer */}
      {conversationPost && (
        <ConversationDrawer
          isVisible={!!conversationPost}
          onClose={handleCloseConversation}
          post={conversationPost}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchHeader: {
    paddingTop: 10,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    marginRight: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 40,
    borderWidth: 0,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    paddingVertical: 0,
  },
  clearIcon: {
    marginLeft: theme.spacing.xs,
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
  },
  tab: {
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.text,
  },
  tabText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
  },
  activeTabText: {
    color: theme.colors.text,
  },
  resultsContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  allViewHeader: {
    paddingBottom: theme.spacing.sm,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  userFollowers: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    marginTop: 2,
  },
  recentContainer: {
    padding: theme.spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  recentTitle: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  clearAllText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.primary,
  },
  recentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  recentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentItemText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  removeRecentButton: {
    padding: theme.spacing.xs,
  },
  emptyContent: {
    flex: 1,
    paddingTop: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyMessage: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
});
