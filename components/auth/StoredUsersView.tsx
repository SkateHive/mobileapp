


import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { Ionicons } from '@expo/vector-icons';
import type { StoredUser } from '../../lib/types';

interface StoredUsersViewProps {
  users: StoredUser[];
  onQuickLogin: (user: StoredUser) => void;
  isDarkColorScheme: boolean;
  onDeleteUser?: (username: string) => void;
}



export function StoredUsersView({ users, onQuickLogin, isDarkColorScheme, onDeleteUser }: StoredUsersViewProps) {
  return (
    <View className="w-full max-w-sm">
      <ScrollView
        className="max-h-[200px]"
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {users
          .filter(user => user.username !== "SPECTATOR")
          .map((user) => (
            <View
              key={user.username}
              className="flex-row items-center justify-between px-2 mb-2"
            >
              <Button
                onPress={() => onQuickLogin(user)}
                variant="ghost"
                className="flex-1 flex-row items-center justify-between px-4 py-3"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="person-circle-outline"
                    size={24}
                    color={isDarkColorScheme ? '#ffffff' : '#000000'}
                  />
                  <Text className="text-lg font-medium text-foreground ml-2">
                    {'@' + user.username}
                  </Text>
                  <Text className="ml-2 text-xs text-foreground/60">
                    {user.method === 'pin' ? 'PIN' : 'Biometric'}
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward-outline"
                  size={20}
                  color={isDarkColorScheme ? '#ffffff80' : '#00000080'}
                />
              </Button>
              {onDeleteUser && (
                <Pressable
                  onPress={() => onDeleteUser(user.username)}
                  className="ml-2 p-2 rounded-full active:bg-destructive/20"
                  accessibilityLabel={`Delete @${user.username}`}
                  hitSlop={8}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={isDarkColorScheme ? '#ef4444' : '#dc2626'}
                  />
                </Pressable>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}