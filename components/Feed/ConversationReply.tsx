import React, { useState } from 'react';
import {
  View,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../ui/text';
import { EnhancedMarkdownRenderer } from '../markdown/EnhancedMarkdownRenderer';
import { MediaPreview } from './MediaPreview';
import { ReplyComposer } from '../ui/ReplyComposer';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import { vote as hiveVote } from '~/lib/hive-utils';
import { theme } from '~/lib/theme';
import { extractMediaFromBody } from '~/lib/utils';
import type { Discussion } from '@hiveio/dhive';
import type { Media } from '../../lib/types';

// Helper function to format time in abbreviated format
const formatTimeAbbreviated = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return '1m';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y`;
};

interface ConversationReplyProps {
  post: Discussion;
  currentUsername: string | null;
  depth?: number;
  maxDepth?: number;
  onReplySuccess?: (newReply: Discussion) => void;
}

export function ConversationReply({ 
  post, 
  currentUsername, 
  depth = 0,
  maxDepth = 3,
  onReplySuccess
}: ConversationReplyProps) {
  const { session } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [voteCount, setVoteCount] = useState(
    Array.isArray(post.active_votes)
      ? post.active_votes.filter((vote: any) => vote.weight > 0).length
      : 0
  );
  const { showToast } = useToast();

  const handleMediaPress = (media: Media) => {
    setSelectedMedia(media);
    setIsModalVisible(true);
  };

  const handleVote = async () => {
    try {
      setIsVoting(true);

      if (!session || !session.username || !session.decryptedKey) {
        showToast('Please login first', 'error');
        return;
      }

      if (session.username === "SPECTATOR") {
        showToast('Please login first', 'error');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const previousLikedState = isLiked;
      setIsLiked(!isLiked);
      setVoteCount(prevCount => previousLikedState ? prevCount - 1 : prevCount + 1);

      try {
        await hiveVote(
          session.decryptedKey,
          session.username,
          post.author,
          post.permlink,
          previousLikedState ? 0 : 10000 // Full vote weight
        );
      } catch (err) {
        setIsLiked(previousLikedState);
        setVoteCount(prevCount => previousLikedState ? prevCount + 1 : prevCount - 1);
        throw err;
      }
    } catch (error) {
      let errorMessage = 'Failed to vote';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsVoting(false);
    }
  };

  const handleProfilePress = () => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username: post.author }
    });
  };

  const handleReplyPress = () => {
    setShowReplyComposer(!showReplyComposer);
  };

  const handleReplySuccess = (newReply: Discussion) => {
    setShowReplyComposer(false);
    if (onReplySuccess) {
      onReplySuccess(newReply);
    }
  };

  const media = extractMediaFromBody(post.body);
  const postContent = post.body.replace(/<iframe.*?<\/iframe>|!\[.*?\]\(.*?\)/g, '').trim();

  return (
    <View style={styles.container}>
      <View style={styles.mainLayout}>
        {/* Left column: Profile pic */}
        <View style={styles.leftColumn}>
          <Pressable onPress={handleProfilePress}>
            <Image
              source={{ uri: `https://images.ecency.com/webp/u/${post.author}/avatar/small` }}
              style={styles.profileImage}
              alt={`${post.author}'s avatar`}
            />
          </Pressable>
        </View>
        
        {/* Right column: Content */}
        <View style={styles.rightColumn}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <Pressable onPress={handleProfilePress}>
              <Text style={styles.authorText}>{post.author}</Text>
            </Pressable>
            <Text style={styles.dateText}>
              {(() => {
                const dateStr = post.created;
                if (!dateStr) return '';
                const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
                if (isNaN(date.getTime())) return '';
                return formatTimeAbbreviated(date);
              })()}
            </Text>
          </View>

          {/* Content */}
          <Pressable onPress={handleReplyPress} style={styles.pressableContent}>
            {postContent !== '' && (
              <View style={styles.contentContainer}>
                <EnhancedMarkdownRenderer content={postContent} />
              </View>
            )}

            {media.length > 0 && (
              <View style={styles.mediaContainer}>
                <MediaPreview
                  media={media}
                  onMediaPress={handleMediaPress}
                  selectedMedia={selectedMedia}
                  isModalVisible={isModalVisible}
                  onCloseModal={() => setIsModalVisible(false)}
                />
              </View>
            )}
          </Pressable>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Pressable onPress={handleReplyPress} style={styles.actionItem}>
              <FontAwesome name="comment-o" size={10} color={theme.colors.gray} />
              <Text style={styles.actionText}>{post.children}</Text>
            </Pressable>
            
            <Pressable
              onPress={handleVote}
              style={[styles.actionItem, isVoting && styles.disabledButton]}
              disabled={isVoting}
            >
              {isVoting ? (
                <ActivityIndicator size="small" color={theme.colors.green} />
              ) : (
                <>
                  <Text style={[styles.voteCount, { color: isLiked ? theme.colors.green : theme.colors.gray }]}>
                    {voteCount}
                  </Text>
                  <FontAwesome
                    name="arrow-up"
                    size={10}
                    color={isLiked ? theme.colors.green : theme.colors.gray}
                  />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Reply Composer - shown when replying to this specific comment */}
      {showReplyComposer && (
        <ReplyComposer
          parentAuthor={post.author}
          parentPermlink={post.permlink}
          onReplySuccess={handleReplySuccess}
          placeholder={`Reply to @${post.author}...`}
          buttonLabel="REPLY"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.sm,
  },
  mainLayout: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 32,
    marginRight: theme.spacing.xs,
  },
  rightColumn: {
    flex: 1,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xxs,
  },
  pressableContent: {
    // Transparent pressable area for content
  },
  authorText: {
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  dateText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
  },
  contentContainer: {
    marginBottom: theme.spacing.xxs,
  },
  mediaContainer: {
    marginBottom: theme.spacing.xxs,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxs,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
  actionText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gray,
  },
  voteCount: {
    fontSize: theme.fontSizes.xs,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
