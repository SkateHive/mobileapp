import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { Text } from '../ui/text';
import { theme } from '~/lib/theme';
import { getFollowing, getFollowers, setUserRelationship } from '~/lib/hive-utils';
import { useAuth } from '~/lib/auth-provider';
import { getMutedList, getBlacklistedList } from '~/lib/api';

interface FollowersModalProps {
  visible: boolean;
  onClose: () => void;
  username: string;
  type: 'followers' | 'following' | 'muted' | 'blocked';
}

interface UserItemProps {
  username: string;
  onPress: (username: string) => void;
  showUnblockButton?: boolean;
  onUnblock?: (username: string) => void;
}

const UserItem: React.FC<UserItemProps> = ({ username, onPress, showUnblockButton, onUnblock }) => {
  return (
    <Pressable
      style={styles.userItem}
      onPress={() => onPress(username)}
    >
      <Image
        source={{ uri: `https://images.hive.blog/u/${username}/avatar/small` }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>@{username}</Text>
      </View>
      {showUnblockButton && onUnblock ? (
        <Pressable
          style={styles.unblockButton}
          onPress={(e) => {
            e.stopPropagation();
            onUnblock(username);
          }}
        >
          <Text style={styles.unblockText}>Unblock</Text>
        </Pressable>
      ) : (
        <FontAwesome 
          name="chevron-right" 
          size={16} 
          color={theme.colors.gray} 
        />
      )}
    </Pressable>
  );
};

export const FollowersModal: React.FC<FollowersModalProps> = ({
  visible,
  onClose,
  username,
  type,
}) => {
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { session, username: currentUsername, blockedList, updateUserRelationship } = useAuth();

  useEffect(() => {
    if (visible) {
      loadUsers();
    }
  }, [visible, username, type]);

  const loadUsers = async (startFrom: string = '', append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
        setUsers([]);
      } else {
        setLoadingMore(true);
      }

      let newUsers: string[];
      if (type === 'followers') {
        newUsers = await getFollowers(username, startFrom, 50);
      } else if (type === 'following') {
        newUsers = await getFollowing(username, startFrom, 50);
      } else if (type === 'muted' || type === 'blocked') {
        if (username === currentUsername) {
          // Use the cached list from AuthProvider for current user
          newUsers = blockedList;
        } else {
          // Fallback to API for other users
          const [muted, blacklisted] = await Promise.all([
            getMutedList(username),
            getBlacklistedList(username)
          ]);
          newUsers = Array.from(new Set([...muted, ...blacklisted]));
        }
        setHasMore(false);
      } else {
        newUsers = [];
        setHasMore(false);
      }

      if (append) {
        setUsers(prev => [...prev, ...newUsers]);
      } else {
        setUsers(newUsers);
      }

      // If we got fewer results than the page size, we've reached the end
      if (type === 'followers' || type === 'following') {
        setHasMore(newUsers.length === 50);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && users.length > 0) {
      const lastUser = users[users.length - 1];
      loadUsers(lastUser, true);
    }
  };

  const handleUserPress = (selectedUsername: string) => {
    onClose();
    // Navigate to the selected user's profile
    router.push({
      pathname: '/(tabs)/profile',
      params: { username: selectedUsername },
    });
  };

  const handleUnblock = async (targetUsername: string) => {
    try {
      // Remove all relationships (unblock)
      const success = await updateUserRelationship(targetUsername, '');
      
      if (success) {
        // Remove from local state
        setUsers(prevUsers => prevUsers.filter(user => user !== targetUsername));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const renderUser = ({ item }: { item: string }) => (
    <UserItem 
      username={item} 
      onPress={handleUserPress}
      showUnblockButton={type === 'muted' || type === 'blocked'}
      onUnblock={(type === 'muted' || type === 'blocked') ? handleUnblock : undefined}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.colors.green} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No {type} found
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {type === 'followers' ? 'Followers' : type === 'following' ? 'Following' : 'Blocked Users'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* User List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.green} />
              <Text style={styles.loadingText}>Loading {type === 'muted' || type === 'blocked' ? 'blocked users' : type}...</Text>
            </View>
          ) : (
            <FlatList
              data={users}
              renderItem={renderUser}
              keyExtractor={(item) => item}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    maxHeight: '90%',
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  listContent: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  loadingFooter: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
  },
  unblockButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  unblockText: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
  },
});