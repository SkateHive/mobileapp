import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/text';
import { theme } from '~/lib/theme';

interface BadgedIconProps {
  name: string;
  color: string;
  badgeCount?: number;
  size?: number;
}

export function BadgedIcon({ name, color, badgeCount = 0, size = 24 }: BadgedIconProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={name as any} size={size} color={color} style={styles.icon} />
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount.toString()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  icon: {
    marginBottom: -10,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff3333', // Red color for notifications
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
    lineHeight: 13,
  },
});
