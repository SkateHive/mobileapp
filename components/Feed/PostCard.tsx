import React, { useCallback, useState, useEffect } from 'react';
import { FontAwesome } from '@expo/vector-icons';
// import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, View, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
// import { API_BASE_URL } from '~/lib/constants';
import { vote as hiveVote } from '~/lib/hive-utils';
import { useAuth } from '~/lib/auth-provider';
import { useVoteValue } from '~/lib/hooks/useVoteValue';
import { Text } from '../ui/text';
import { VotingSlider } from '../ui/VotingSlider';
import { MediaPreview } from './MediaPreview';
import { EnhancedMarkdownRenderer } from '../markdown/EnhancedMarkdownRenderer';
import { ConversationDrawer } from './ConversationDrawer';
import { useToast } from '~/lib/toast-provider';
import { theme } from '~/lib/theme';
import type { Media } from '../../lib/types';
import type { Discussion } from '@hiveio/dhive';
import { extractMediaFromBody } from '~/lib/utils';

// Helper function to format time in abbreviated format (2 characters max)
const formatTimeAbbreviated = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return '1m'; // Less than a minute, show 1m
  
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

interface PostCardProps {
  post: Discussion;
  currentUsername: string | null;
}


export function PostCard({ post, currentUsername }: PostCardProps) {
  const { session } = useAuth();
  const { estimateVoteValue, isLoading: isVoteValueLoading } = useVoteValue(currentUsername);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [voteWeight, setVoteWeight] = useState(100);
  const [isLiked, setIsLiked] = useState(false);
  const [isConversationDrawerVisible, setIsConversationDrawerVisible] = useState(false);
  // Use active_votes for vote count
  const [voteCount, setVoteCount] = useState(
    Array.isArray(post.active_votes)
      ? post.active_votes.filter((vote: any) => vote.weight > 0).length
      : 0
  );
  // Track the post's payout value for dynamic updates
  const [payoutValue, setPayoutValue] = useState(() => {
    const pending = parseFloat(post.pending_payout_value?.toString?.() || '0');
    const total = parseFloat(post.total_payout_value?.toString?.() || '0');
    const curator = parseFloat(post.curator_payout_value?.toString?.() || '0');
    return pending + total + curator;
  });
  const { showToast } = useToast();

  // Check if user has already voted on this post
  useEffect(() => {
    if (currentUsername && Array.isArray(post.active_votes)) {
      const hasVoted = post.active_votes.some((vote: any) => vote.voter === currentUsername && vote.weight > 0);
      setIsLiked(hasVoted);
    }
  }, [post.active_votes, currentUsername]);

  const handleMediaPress = useCallback((media: Media) => {
    setSelectedMedia(media);
    setIsModalVisible(true);
  }, []);

  const handleVote = async (customWeight?: number) => {
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

      // Trigger haptic feedback before the vote
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Calculate vote value before submitting
      const votePercentage = customWeight ?? voteWeight;
      let estimatedValue = 0;
      
      try {
        if (!isVoteValueLoading) {
          estimatedValue = await estimateVoteValue(votePercentage);
        }
      } catch (err) {
        // Continue with vote even if estimation fails
      }

      // Optimistically update the UI
      const previousLikedState = isLiked;
      const previousVoteCount = voteCount;
      const previousPayoutValue = payoutValue;
      
      setIsLiked(!isLiked);
      setVoteCount(prevCount => previousLikedState ? prevCount - 1 : prevCount + 1);
      
      // Update payout value if we have an estimation and user is voting (not unvoting)
      if (estimatedValue > 0 && !previousLikedState) {
        setPayoutValue(prev => prev + estimatedValue);
      }

      try {
        await hiveVote(
          session.decryptedKey,
          session.username,
          post.author,
          post.permlink,
          previousLikedState ? 0 : Math.round(votePercentage * 100)
        );
        
        // Show simple success toast
        showToast('Vote submitted!', 'success');
      } catch (err) {
        // Revert the optimistic updates if the request failed
        setIsLiked(previousLikedState);
        setVoteCount(previousVoteCount);
        setPayoutValue(previousPayoutValue);
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
      setShowSlider(false);
    }
  };

  const calculateTotalValue = () => {
    return payoutValue.toFixed(3);
  };

  const navigateToProfile = (username: string) => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username }
    });
  };

  const media = extractMediaFromBody(post.body);
  const postContent = post.body.replace(/<iframe.*?<\/iframe>|!\[.*?\]\(.*?\)/g, '').trim();
  
  const handleProfilePress = () => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username: post.author }
    });
  };

  const handleConversationPress = () => {
    setIsConversationDrawerVisible(true);
  };

  // Create dynamic styles based on theme with Fira Code font

  return (
    <>
      <View style={styles.container}>
        {/* Two-column layout: Profile pic | Everything else */}
        <View style={styles.mainLayout}>
          {/* Left column: Profile pic only */}
          <View style={styles.leftColumn}>
            <Pressable onPress={handleProfilePress}>
              <Image
                source={{ uri: `https://images.hive.blog/u/${post.author}/avatar/small` }}
                style={styles.profileImage}
                alt={`${post.author}'s avatar`}
              />
            </Pressable>
          </View>
          
          {/* Right column: All content */}
          <View style={styles.rightColumn}>
            {/* Header with author and date */}
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
            <View>
              {postContent !== '' && (
                <View style={styles.contentContainer}>
                  <EnhancedMarkdownRenderer content={postContent} />
                </View>
              )}

              {/* Media */}
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
            </View>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              {showSlider ? (
                /* Voting slider mode - takes entire bottom bar */
                <View style={styles.votingSliderContainer}>
                  <VotingSlider
                    value={voteWeight}
                    onValueChange={setVoteWeight}
                    minimumValue={1}
                    maximumValue={100}
                  />
                  <View style={styles.sliderControls}>
                    <Pressable
                      style={styles.cancelVoteButton}
                      onPress={() => setShowSlider(false)}
                      disabled={isVoting}
                    >
                      <FontAwesome name="times" size={20} color={theme.colors.gray} />
                    </Pressable>
                    <Pressable
                      style={[styles.confirmVoteButton, isVoting && styles.disabledButton]}
                      onPress={() => handleVote(voteWeight)}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <ActivityIndicator size="small" color={theme.colors.green} />
                      ) : (
                        <FontAwesome name="arrow-up" size={20} color={theme.colors.green} />
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* Normal bottom bar mode */
                <>
                  <Text style={[styles.payoutText, { color: parseFloat(calculateTotalValue()) > 0 ? theme.colors.green : theme.colors.gray }]}>
                    ${calculateTotalValue()}
                  </Text>
                  
                  <View style={styles.actionsContainer}>
                    {/* Replies section - clickable to open conversation */}
                    <Pressable onPress={handleConversationPress} style={styles.actionItem}>
                      <FontAwesome name="comment-o" size={20} color={theme.colors.gray} />
                      <Text style={styles.actionText}>{post.children}</Text>
                    </Pressable>
                    
                    {/* Voting section */}
                    <Pressable
                      onPress={() => setShowSlider(true)}
                      style={[styles.actionItem, isVoting && styles.disabledButton]}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <ActivityIndicator 
                          size="small" 
                          color={isLiked ? theme.colors.green : theme.colors.gray}
                        />
                      ) : (
                        <>
                          <Text style={[styles.voteCount, { color: isLiked ? theme.colors.green : theme.colors.gray }]}>
                            {voteCount}
                          </Text>
                          <FontAwesome
                            name="arrow-up"
                            size={20}
                            color={isLiked ? theme.colors.green : theme.colors.gray}
                          />
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Conversation Drawer */}
      <ConversationDrawer
        visible={isConversationDrawerVisible}
        onClose={() => setIsConversationDrawerVisible(false)}
        discussion={post}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 0,
    backgroundColor: theme.colors.card,
    padding: 0,
  },
  mainLayout: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 42, // Fixed width for profile pic column
    marginRight: theme.spacing.sm,
  },
  rightColumn: {
    flex: 1, // Takes remaining space
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 0,
  },
  authorText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  dateText: {
    fontSize: theme.fontSizes.xs, // Force consistent font size
    color: theme.colors.muted,
  },
  contentContainer: {
    marginBottom: 0,
  },
  contentText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.text,
    lineHeight: 20,
    fontFamily: theme.fonts.default,
  },
  linkText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.green,
    textDecorationLine: 'underline',
  },
  mentionText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.green,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
  mediaContainer: {
    marginBottom: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  payoutText: {
    fontSize: theme.fontSizes.md, 
    fontFamily: theme.fonts.regular,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 0,
    borderRadius: theme.borderRadius.xs,
  },
  actionText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.gray,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.xs,
  },
  voteCount: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    fontFamily: theme.fonts.regular,
  },
  disabledButton: {
    opacity: 0.7,
  },
  // New styles for full-width voting slider
  votingSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 32,
    marginBottom: theme.spacing.xxs,
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginLeft: theme.spacing.xs,
  },
  cancelVoteButton: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  confirmVoteButton: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
});