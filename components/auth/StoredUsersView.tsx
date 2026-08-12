import React from 'react';
import { ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/text';
import { theme } from '~/lib/theme';
import { HIVE_AVATAR_URL } from '~/lib/constants';
import type { StoredUser } from '../../lib/types';

interface StoredUsersViewProps {
  users: StoredUser[];
  onQuickLogin: (user: StoredUser) => void;
  onDeleteUser?: (username: string) => void;
}

/**
 * The saved accounts behind "Switch account" (#60).
 *
 * Pills, matching everything else on the sign-in screens. Removing an account
 * is a long-press: a trash can sitting permanently beside every row put a
 * destructive action one stray tap away, and made the list about deleting.
 */
export function StoredUsersView({ users, onQuickLogin, onDeleteUser }: StoredUsersViewProps) {
  const confirmDelete = (username: string) => {
    if (!onDeleteUser) return;
    Alert.alert(
      `Remove @${username}?`,
      'The key stored on this device is deleted. Your Hive account is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onDeleteUser(username) },
      ]
    );
  };

  return (
    <ScrollView style={styles.list} bounces={false} showsVerticalScrollIndicator={false}>
      {users
        .filter((user) => user.username !== 'SPECTATOR')
        .map((user) => (
          <Pressable
            key={user.username}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onQuickLogin(user)}
            accessibilityRole="button"
            accessibilityLabel={`Sign in as ${user.username}`}
          >
            <Image
              source={{ uri: `${HIVE_AVATAR_URL}/${user.username}/avatar` }}
              style={styles.avatar}
              contentFit="cover"
            />
            <Text style={styles.username}>@{user.username}</Text>
            <Text style={styles.method}>
              {user.method === 'pin' ? 'PIN' : 'Face ID'}
            </Text>
            {onDeleteUser && (
              <Pressable
                onPress={() => confirmDelete(user.username)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${user.username}`}
              >
                {({ pressed }) => (
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.danger}
                    style={pressed && styles.pressedIcon}
                  />
                )}
              </Pressable>
            )}
          </Pressable>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxHeight: 200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.surface,
    borderWidth: 1,
    borderColor: theme.auth.borderIdle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.sm,
  },
  rowPressed: { borderColor: theme.auth.neon },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  username: {
    flex: 1,
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  method: {
    color: theme.auth.textTertiary,
    fontFamily: theme.fonts.default,
    fontSize: 11,
  },
  pressedIcon: { opacity: 0.5 },
});
