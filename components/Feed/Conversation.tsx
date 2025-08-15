import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Text } from '../ui/text';
import { PostCard } from '../Feed/PostCard';
import { useReplies } from '~/lib/hooks/useReplies';
import { useAuth } from '~/lib/auth-provider';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

interface ConversationProps {
  discussion: Discussion;
  onClose: () => void;
}

export function Conversation({ discussion, onClose }: ConversationProps) {
  const { username } = useAuth();
  const { comments, isLoading, error } = useReplies(
    discussion.author,
    discussion.permlink,
    true
  );

  const [optimisticReplies, setOptimisticReplies] = useState<Discussion[]>([]);

  const handleNewReply = (newComment: Partial<Discussion>) => {
    const newReply = newComment as Discussion;
    setOptimisticReplies((prev) => [...prev, newReply]);
  };

  const allReplies = [...optimisticReplies, ...comments];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversation</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <FontAwesome name="times" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Post */}
        <View style={styles.mainPostContainer}>
          <PostCard post={discussion} currentUsername={username} />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Replies Section */}
        <View style={styles.repliesContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.green} />
              <Text style={styles.loadingText}>Loading comments...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error loading comments: {error}</Text>
            </View>
          ) : allReplies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
            </View>
          ) : (
            <>
              {/* Render all replies */}
              {allReplies.map((reply, index) => (
                <View key={`${reply.author}/${reply.permlink}-${index}`} style={styles.replyContainer}>
                  <PostCard 
                    post={reply} 
                    currentUsername={username}
                  />
                  {/* Add separator between replies except for the last one */}
                  {index < allReplies.length - 1 && (
                    <View style={styles.replySeparator} />
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  closeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  content: {
    flex: 1,
  },
  mainPostContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  repliesContainer: {
    padding: theme.spacing.md,
  },
  replyContainer: {
    marginBottom: theme.spacing.xs,
  },
  replySeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
    marginLeft: 54, // Align with content, offset by profile picture width
  },
  loadingContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
  },
  errorContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
});
