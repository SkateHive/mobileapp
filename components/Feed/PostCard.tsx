import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { FontAwesome } from '@expo/vector-icons';
// import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, View, Linking, ActivityIndicator, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
// import { API_BASE_URL } from '~/lib/constants';
import { vote as hiveVote, submitEncryptedReport } from '~/lib/hive-utils';
import { useAuth } from '~/lib/auth-provider';
import { useVoteValue } from '~/lib/hooks/useVoteValue';
import { useViewportTracker } from '~/lib/ViewportTracker';
import { Text } from '../ui/text';
import { VotingSlider } from '../ui/VotingSlider';
import { MediaPreview } from './MediaPreview';
import { EnhancedMarkdownRenderer } from '../markdown/EnhancedMarkdownRenderer';
import { ConversationDrawer } from './ConversationDrawer';
import { FullConversationDrawer } from './FullConversationDrawer';
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


export const PostCard = React.memo(({ post, currentUsername }: PostCardProps) => {
  const { session, followingList, updateUserRelationship } = useAuth();
  const { estimateVoteValue, isLoading: isVoteValueLoading } = useVoteValue(currentUsername);
  const { isItemVisible, registerItem, unregisterItem } = useViewportTracker();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [voteWeight, setVoteWeight] = useState(100);
  const [isLiked, setIsLiked] = useState(false);
  const [isConversationDrawerVisible, setIsConversationDrawerVisible] = useState(false);
  const [isFullConversationVisible, setIsFullConversationVisible] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const [reportAdditionalInfo, setReportAdditionalInfo] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // Register/unregister with viewport tracker
  useEffect(() => {
    registerItem(post.permlink);
    return () => unregisterItem(post.permlink);
  }, [post.permlink, registerItem, unregisterItem]);
  
  // Check if this post is currently visible
  const isVisible = isItemVisible(post.permlink);
  
  // Memoize expensive calculations
  const initialVoteCount = useMemo(() => 
    Array.isArray(post.active_votes)
      ? post.active_votes.filter((vote: any) => vote.weight > 0).length
      : 0,
    [post.active_votes]
  );
  
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  
  // Memoize payout value calculation
  const initialPayoutValue = useMemo(() => {
    const pending = parseFloat(post.pending_payout_value?.toString?.() || '0');
    const total = parseFloat(post.total_payout_value?.toString?.() || '0');
    const curator = parseFloat(post.curator_payout_value?.toString?.() || '0');
    return pending + total + curator;
  }, [post.pending_payout_value, post.total_payout_value, post.curator_payout_value]);
  
  // Track the post's payout value for dynamic updates
  const [payoutValue, setPayoutValue] = useState(initialPayoutValue);
  const { showToast } = useToast();

  // Memoize media extraction
  const media = useMemo(() => extractMediaFromBody(post.body), [post.body]);
  
  // Memoize post content processing
  const postContent = useMemo(() => 
    post.body.replace(/<iframe.*?<\/iframe>|!\[.*?\]\(.*?\)/g, '').trim(),
    [post.body]
  );
  
  // Memoize formatted date
  const formattedDate = useMemo(() => {
    const dateStr = post.created;
    if (!dateStr) return '';
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    if (isNaN(date.getTime())) return '';
    return formatTimeAbbreviated(date);
  }, [post.created]);

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

  const handleProfilePress = () => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username: post.author }
    });
  };

  const handleConversationPress = () => {
    setIsConversationDrawerVisible(true);
  };

  const handleBodyPress = () => {
    setIsFullConversationVisible(true);
  };

  const handleUserMenuPress = () => {
    setShowUserMenu(true);
  };

  const handleUserAction = async (action: 'follow' | 'unfollow' | 'mute') => {
    if (!session || session.username === 'SPECTATOR') {
      showToast('Please login first', 'error');
      return;
    }

    try {
      let relationship: 'blog' | 'ignore' | '' = '';
      let successMessage = '';

      switch (action) {
        case 'follow':
          relationship = 'blog';
          successMessage = `Following ${post.author}`;
          break;
        case 'unfollow':
          relationship = '';
          successMessage = `Unfollowed ${post.author}`;
          break;
        case 'mute':
          relationship = 'ignore';
          successMessage = `Muted ${post.author}`;
          break;
      }

      const success = await updateUserRelationship(post.author, relationship);
      if (success) {
        showToast(successMessage, 'success');
      } else {
        showToast('Failed to update relationship', 'error');
      }
    } catch (error) {
      showToast('Failed to update relationship', 'error');
    } finally {
      setShowUserMenu(false);
    }
  };

  const handleReportPost = () => {
    setShowReportModal(true);
    setShowUserMenu(false);
  };

  const handleSubmitReport = async () => {
    if (!selectedReportReason) {
      showToast('Please select a reason for reporting', 'error');
      return;
    }

    if (!session || session.username === 'SPECTATOR') {
      showToast('Please login first', 'error');
      return;
    }

    try {
      setIsSubmittingReport(true);
      
      const success = await submitEncryptedReport(
        session.decryptedKey!,
        session.username,
        post.author,
        post.permlink,
        selectedReportReason,
        reportAdditionalInfo
      );

      if (success) {
        showToast('Report submitted successfully', 'success');
        setShowReportModal(false);
        setSelectedReportReason('');
        setReportAdditionalInfo('');
      } else {
        showToast('Failed to submit report', 'error');
      }
    } catch (error) {
      let errorMessage = 'Failed to submit report';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmittingReport(false);
    }
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
                {formattedDate}
              </Text>
              
              {/* Three dots menu - only show if not viewing own post */}
              {currentUsername && post.author !== currentUsername && (
                <Pressable onPress={handleUserMenuPress} style={styles.menuButton}>
                  <FontAwesome name="ellipsis-h" size={16} color={theme.colors.text} />
                </Pressable>
              )}
            </View>

            {/* Content */}
            <Pressable onPress={handleBodyPress}>
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
                    isVisible={isVisible}
                  />
                </View>
              )}
            </Pressable>

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

      {/* Conversation Drawer - Quick reply only */}
      <ConversationDrawer
        visible={isConversationDrawerVisible}
        onClose={() => setIsConversationDrawerVisible(false)}
        discussion={post}
      />

      {/* Full Conversation Drawer - Entire conversation thread */}
      <FullConversationDrawer
        visible={isFullConversationVisible}
        onClose={() => setIsFullConversationVisible(false)}
        discussion={post}
      />

      {/* User Menu Modal */}
      <Modal
        visible={showUserMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowUserMenu(false)}>
          <View style={styles.userMenuContainer}>
            <Text style={styles.userMenuTitle}>@{post.author}</Text>
            
            {followingList.includes(post.author) ? (
              <Pressable
                style={styles.userMenuButton}
                onPress={() => handleUserAction('unfollow')}
              >
                <Text style={styles.userMenuButtonText}>Unfollow</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.userMenuButton}
                onPress={() => handleUserAction('follow')}
              >
                <Text style={styles.userMenuButtonText}>Follow</Text>
              </Pressable>
            )}
            
            <Pressable
              style={styles.userMenuButton}
              onPress={() => handleUserAction('mute')}
            >
              <Text style={styles.userMenuButtonText}>Mute/Block</Text>
            </Pressable>
            
            <Pressable
              style={styles.userMenuButton}
              onPress={() => handleReportPost()}
            >
              <Text style={styles.userMenuButtonText}>Report Post</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalContainer}>
            <ScrollView style={styles.reportModalContent}>
              <Text style={styles.reportModalTitle}>Report Post</Text>
              <Text style={styles.reportModalSubtitle}>@{post.author}</Text>
              
              <Text style={styles.reportSectionTitle}>Reason for reporting:</Text>
              
              {['Spam', 'Harassment or Abuse', 'Inappropriate Content', 'Copyright Violation', 'Misinformation', 'Other'].map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reportReasonButton,
                    selectedReportReason === reason && styles.reportReasonButtonSelected
                  ]}
                  onPress={() => setSelectedReportReason(reason)}
                >
                  <Text style={[
                    styles.reportReasonText,
                    selectedReportReason === reason && styles.reportReasonTextSelected
                  ]}>
                    {reason}
                  </Text>
                </Pressable>
              ))}
              
              <Text style={styles.reportSectionTitle}>Additional Information (Optional):</Text>
              <TextInput
                style={styles.reportTextInput}
                multiline
                numberOfLines={4}
                placeholder="Provide additional details about this report..."
                placeholderTextColor={theme.colors.gray}
                value={reportAdditionalInfo}
                onChangeText={setReportAdditionalInfo}
                editable={!isSubmittingReport}
              />
              
              <View style={styles.reportModalButtons}>
                <Pressable
                  style={[styles.reportModalButton, styles.reportCancelButton]}
                  onPress={() => setShowReportModal(false)}
                  disabled={isSubmittingReport}
                >
                  <Text style={styles.reportCancelButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  style={[
                    styles.reportModalButton, 
                    styles.reportSubmitButton,
                    (!selectedReportReason || isSubmittingReport) && styles.reportSubmitButtonDisabled
                  ]}
                  onPress={handleSubmitReport}
                  disabled={!selectedReportReason || isSubmittingReport}
                >
                  {isSubmittingReport ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
});

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
  menuButton: {
    padding: theme.spacing.xs,
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMenuContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    minWidth: 200,
  },
  userMenuTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
  },
  userMenuButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
  },
  userMenuButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
  },
  // Report Modal Styles
  reportModalContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    margin: theme.spacing.md,
    maxHeight: '80%',
    width: '90%',
    alignSelf: 'center',
  },
  reportModalContent: {
    padding: theme.spacing.lg,
  },
  reportModalTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.bold,
  },
  reportModalSubtitle: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.gray,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.regular,
  },
  reportSectionTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.bold,
  },
  reportReasonButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray,
    backgroundColor: 'transparent',
  },
  reportReasonButtonSelected: {
    backgroundColor: 'rgba(50, 205, 50, 0.2)',
    borderColor: theme.colors.green,
  },
  reportReasonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
  },
  reportReasonTextSelected: {
    color: theme.colors.green,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
  reportTextInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    textAlignVertical: 'top',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.regular,
  },
  reportModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  reportModalButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray,
  },
  reportCancelButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.gray,
    fontFamily: theme.fonts.regular,
  },
  reportSubmitButton: {
    backgroundColor: theme.colors.green,
  },
  reportSubmitButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.5,
  },
  reportSubmitButtonText: {
    fontSize: theme.fontSizes.md,
    color: '#000',
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
});