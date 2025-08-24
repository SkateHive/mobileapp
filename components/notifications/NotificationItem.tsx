import React from 'react';
import { View, Pressable, StyleSheet, Image, Linking } from 'react-native';
import { HiveNotification } from '~/lib/types';
import { Text } from '../ui/text';
import { theme } from '~/lib/theme';

interface NotificationItemProps {
  notification: HiveNotification;
}

export const NotificationItem = React.memo(({ notification }: NotificationItemProps) => {
  // Extract author from the notification message (usually starts with @username)
  const getAuthor = (msg: string): string => {
    const match = msg.match(/@([a-zA-Z0-9.-]+)/);
    return match ? match[1] : 'user';
  };

  // Format the notification date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'Z');
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return date.toLocaleDateString();
  };

  const handlePress = async () => {
    if (notification.url) {
      try {
        // Try to open the URL - in a real app you might navigate to an internal screen
        const url = notification.url.startsWith('http') 
          ? notification.url 
          : `https://ecency.com${notification.url}`;
        
        await Linking.openURL(url);
      } catch (error) {
        console.error('Error opening notification URL:', error);
      }
    }
  };

  const author = getAuthor(notification.msg);
  const isUnread = !notification.isRead;

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]} 
      onPress={handlePress}
    >
      {/* Unread indicator - red dot on the right */}
      {isUnread && <View style={styles.unreadIndicator} />}
      
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: `https://images.hive.blog/u/${author}/avatar/small` }}
          style={styles.avatar}
        />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.message, isUnread && styles.unreadText]} numberOfLines={3}>
          {notification.msg}
        </Text>
        <Text style={styles.date}>
          {formatDate(notification.date)}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'flex-start',
    position: 'relative',
  },
  pressed: {
    backgroundColor: '#111',
  },
  unreadIndicator: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.spacing.md + 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
    zIndex: 1,
  },
  avatarContainer: {
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  message: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.regular,
  },
  unreadText: {
    fontFamily: theme.fonts.bold,
    fontWeight: 'bold',
  },
  date: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.regular,
  },
});
