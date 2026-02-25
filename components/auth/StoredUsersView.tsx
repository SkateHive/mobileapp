import React from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '~/lib/theme';
import type { StoredUser } from '../../lib/types';

interface StoredUsersViewProps {
  users: StoredUser[];
  onQuickLogin: (user: StoredUser) => void;
  onDeleteUser?: (username: string) => void;
}

export function StoredUsersView({ users, onQuickLogin, onDeleteUser }: StoredUsersViewProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {users
          .filter(user => user.username !== "SPECTATOR")
          .map((user) => (
            <View
              key={user.username}
              style={styles.userRow}
            >
              <Button
                onPress={() => onQuickLogin(user)}
                variant="ghost"
                style={styles.userButton}
              >
                <View style={styles.userInfo}>
                  <Image
                    source={{ uri: `https://images.hive.blog/u/${user.username}/avatar` }}
                    style={styles.avatar}
                  />
                  <Text style={styles.username}>
                    {user.username}
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward-outline"
                  size={20}
                  color={theme.colors.muted}
                />
              </Button>
              {onDeleteUser && (
                <Pressable
                  onPress={() => onDeleteUser(user.username)}
                  style={styles.deleteButton}
                  accessibilityLabel={`Delete @${user.username}`}
                  hitSlop={8}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={theme.colors.danger}
                  />
                </Pressable>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
  },
  scrollView: {
    maxHeight: 200,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  userButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.border,
  },
  username: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    marginLeft: theme.spacing.sm,
  },
  deleteButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: 100,
  },
});