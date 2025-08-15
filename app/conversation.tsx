import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '~/components/ui/text';
import { PostCard } from '~/components/Feed/PostCard';
import { ConversationReply } from '~/components/Feed/ConversationReply';
import { ReplyComposer } from '~/components/ui/ReplyComposer';
import { useReplies } from '~/lib/hooks/useReplies';
import { useAuth } from '~/lib/auth-provider';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

export default function ConversationScreen() {
  const { author, permlink, postData } = useLocalSearchParams<{
    author: string;
    permlink: string;
    postData?: string;
  }>();
  const { username } = useAuth();
  
  // Parse the post data if passed
  const mainPost: Discussion | null = postData ? JSON.parse(postData) : null;
  
  const { comments, isLoading, error } = useReplies(
    author || '',
    permlink || '',
    !!(author && permlink)
  );

  const [optimisticReplies, setOptimisticReplies] = useState<Discussion[]>([]);

  const handleBack = () => {
    router.back();
  };

  const handleNewReply = (newComment: Partial<Discussion>) => {
    const newReply = newComment as Discussion;
    setOptimisticReplies((prev) => [...prev, newReply]);
  };

  const handleReplySuccess = (newReply: Discussion) => {
    setOptimisticReplies((prev) => [...prev, newReply]);
  };

  const allReplies = [...optimisticReplies, ...comments];

  if (!author || !permlink) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Conversation</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid conversation parameters</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Conversation</Text>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Post */}
          {mainPost && (
            <View style={styles.mainPostContainer}>
              <PostCard post={mainPost} currentUsername={username} />
            </View>
          )}

          {/* Reply Composer - right under the main post */}
          <ReplyComposer
            parentAuthor={author || ''}
            parentPermlink={permlink || ''}
            onReplySuccess={handleReplySuccess}
            placeholder="Write here"
            buttonLabel="REPLY"
          />

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
                {/* Render all replies using ConversationReply for better threading */}
                {allReplies.map((reply, index) => (
                  <View key={`${reply.author}/${reply.permlink}-${index}`} style={styles.replyContainer}>
                    <ConversationReply 
                      post={reply} 
                      currentUsername={username}
                      depth={reply.depth || 0}
                      maxDepth={3}
                      onReplySuccess={handleReplySuccess}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
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
