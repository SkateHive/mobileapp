import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  TextInput,
  Keyboard,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../ui/text';
import { PostCard } from './PostCard';
import { useReplies } from '~/lib/hooks/useReplies';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import { createHiveComment } from '~/lib/upload/post-utils';
import { uploadVideoToPinata, createVideoIframe } from '~/lib/upload/video-upload';
import { uploadImageToHive, createImageMarkdown } from '~/lib/upload/image-upload';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.85;

interface ConversationDrawerProps {
  visible: boolean;
  onClose: () => void;
  discussion: Discussion;
}

export function ConversationDrawer({ visible, onClose, discussion }: ConversationDrawerProps) {
  const { username, session } = useAuth();
  const { showToast } = useToast();
  const { comments, isLoading, error } = useReplies(
    discussion.author,
    discussion.permlink,
    true
  );

  const [optimisticReplies, setOptimisticReplies] = useState<Discussion[]>([]);
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const translateY = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const allReplies = [...optimisticReplies, ...comments];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: DRAWER_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: DRAWER_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      setIsReplyExpanded(false);
      setReplyContent('');
      setMedia(null);
      setMediaType(null);
    });
  };

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.75,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setMedia(asset.uri);
        setMediaType(asset.type === 'video' ? 'video' : 'image');
      }
    } catch (error) {
      showToast('Failed to select media', 'error');
    }
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaType(null);
  };

  const handleReply = async () => {
    if (!replyContent.trim() && !media) {
      showToast('Please add some content to your reply', 'error');
      return;
    }

    if (!username || username === 'SPECTATOR' || !session?.decryptedKey) {
      showToast('Please log in to reply', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress('');

    try {
      let replyBody = replyContent;

      // Handle media upload
      if (media && mediaType) {
        const fileName = media.split('/').pop() || `${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;

        if (mediaType === 'image') {
          setUploadProgress('Uploading image...');
          const imageResult = await uploadImageToHive(
            media,
            fileName,
            'image/jpeg',
            {
              username,
              privateKey: session.decryptedKey,
            }
          );
          const imageMarkdown = createImageMarkdown(imageResult.url, 'Uploaded image');
          replyBody += replyBody ? `\n\n${imageMarkdown}` : imageMarkdown;
        } else if (mediaType === 'video') {
          setUploadProgress('Uploading video...');
          const videoResult = await uploadVideoToPinata(
            media,
            fileName,
            'video/mp4',
            { creator: username }
          );
          const videoIframe = createVideoIframe(videoResult.IpfsHash, 'Video');
          replyBody += replyBody ? `\n\n${videoIframe}` : videoIframe;
        }
      }

      setUploadProgress('Posting reply...');

      await createHiveComment(
        replyBody,
        discussion.author,
        discussion.permlink,
        {
          username,
          privateKey: session.decryptedKey,
        }
      );

      // Create optimistic reply
      const newReply = {
        author: username,
        permlink: `reply-${Date.now()}`,
        body: replyBody,
        created: new Date().toISOString(),
        parent_author: discussion.author,
        parent_permlink: discussion.permlink,
        children: 0,
        active_votes: [],
        pending_payout_value: '0.000 HBD',
        total_payout_value: '0.000 HBD',
        total_pending_payout_value: '0.000 HBD',
        curator_payout_value: '0.000 HBD',
        root_comment: 0,
        id: Date.now(),
        category: '',
        title: '',
        json_metadata: '{}',
        last_update: new Date().toISOString(),
        active: new Date().toISOString(),
        last_payout: '1970-01-01T00:00:00',
        depth: 0,
        net_rshares: '0',
        abs_rshares: '0',
        vote_rshares: '0',
        children_abs_rshares: '0',
        cashout_time: '1969-12-31T23:59:59',
        max_cashout_time: '1969-12-31T23:59:59',
        total_vote_weight: '0',
        reward_weight: 10000,
        author_rewards: '0',
        net_votes: 0,
        max_accepted_payout: '1000000.000 HBD',
        percent_hbd: 10000,
        allow_replies: true,
        allow_votes: true,
        allow_curation_rewards: true,
        beneficiaries: [],
        url: `/@${username}/reply-${Date.now()}`,
        root_title: '',
        replies: [],
        author_reputation: 0,
        promoted: '0.000 HBD',
        body_length: replyBody.length,
        reblogged_by: [],
        blacklists: [],
      } as unknown as Discussion;

      setOptimisticReplies(prev => [...prev, newReply]);

      // Clear form
      setReplyContent('');
      setMedia(null);
      setMediaType(null);
      setIsReplyExpanded(false);

      showToast('Reply posted successfully!', 'success');
      Keyboard.dismiss();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      showToast(errorMsg, 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const renderSmallReplyBox = () => (
    <Pressable
      style={styles.smallReplyBox}
      onPress={() => setIsReplyExpanded(true)}
    >
      <View style={styles.smallReplyContent}>
        <View style={styles.profilePicSmall}>
          <Text style={styles.profileInitial}>
            {username ? username[0].toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.smallReplyPlaceholder}>Add a comment...</Text>
      </View>
      <View style={styles.smallReplyIcons}>
        <FontAwesome name="smile-o" size={20} color={theme.colors.gray} />
        <FontAwesome name="image" size={18} color={theme.colors.gray} />
      </View>
    </Pressable>
  );

  const renderExpandedReplyBox = () => (
    <View style={styles.expandedReplyBox}>
      {/* Header */}
      <View style={styles.expandedReplyHeader}>
        <Text style={styles.expandedReplyTitle}>Add a comment</Text>
        <Pressable
          onPress={() => setIsReplyExpanded(false)}
          style={styles.collapseButton}
        >
          <FontAwesome name="times" size={18} color={theme.colors.gray} />
        </Pressable>
      </View>

      {/* Upload Progress */}
      {uploadProgress ? (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{uploadProgress}</Text>
        </View>
      ) : null}

      {/* Media Preview */}
      {media && (
        <View style={styles.mediaPreview}>
          {mediaType === 'image' ? (
            <View style={styles.mediaImageContainer}>
              <Text style={styles.mediaLabel}>Image attached</Text>
            </View>
          ) : (
            <View style={styles.mediaImageContainer}>
              <Text style={styles.mediaLabel}>Video attached</Text>
            </View>
          )}
          <Pressable onPress={removeMedia} style={styles.removeMediaButton}>
            <FontAwesome name="times" size={14} color={theme.colors.text} />
          </Pressable>
        </View>
      )}

      {/* Text Input */}
      <TextInput
        multiline
        placeholder="Write your comment..."
        value={replyContent}
        onChangeText={setReplyContent}
        style={styles.expandedTextInput}
        placeholderTextColor={theme.colors.gray}
        maxLength={500}
        autoFocus
      />

      {/* Actions */}
      <View style={styles.expandedActions}>
        <View style={styles.mediaActions}>
          <Pressable
            onPress={pickMedia}
            style={styles.mediaActionButton}
            disabled={isUploading}
          >
            <Ionicons name="image-outline" size={20} color={theme.colors.green} />
          </Pressable>
          <Pressable
            onPress={pickMedia}
            style={styles.mediaActionButton}
            disabled={isUploading}
          >
            <Ionicons name="videocam-outline" size={20} color={theme.colors.green} />
          </Pressable>
        </View>
        
        <Pressable
          onPress={handleReply}
          style={[
            styles.postButton,
            ((!replyContent.trim() && !media) || isUploading) && styles.postButtonDisabled
          ]}
          disabled={(!replyContent.trim() && !media) || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={styles.backdropPress} onPress={handleClose} />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Comments</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Comments */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.green} />
                <Text style={styles.loadingText}>Loading comments...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Error loading comments</Text>
              </View>
            ) : allReplies.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
              </View>
            ) : (
              allReplies.map((reply, index) => (
                <View key={`${reply.author}/${reply.permlink}-${index}`} style={styles.replyContainer}>
                  <PostCard 
                    post={reply} 
                    currentUsername={username}
                  />
                  {index < allReplies.length - 1 && (
                    <View style={styles.replySeparator} />
                  )}
                </View>
              ))
            )}
          </ScrollView>

          {/* Reply Section */}
          {username && username !== 'SPECTATOR' ? (
            <View style={styles.replySection}>
              {isReplyExpanded ? renderExpandedReplyBox() : renderSmallReplyBox()}
            </View>
          ) : (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>Please log in to comment</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: theme.spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
    width: 40,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  replyContainer: {
    marginBottom: theme.spacing.sm,
  },
  replySeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
    marginLeft: 54,
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
  replySection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  smallReplyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },
  smallReplyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePicSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  profileInitial: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
  },
  smallReplyPlaceholder: {
    color: theme.colors.gray,
    fontSize: theme.fontSizes.md,
  },
  smallReplyIcons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  expandedReplyBox: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  expandedReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  expandedReplyTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  collapseButton: {
    padding: theme.spacing.xs,
  },
  progressContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressText: {
    color: theme.colors.green,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  mediaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  mediaImageContainer: {
    flex: 1,
  },
  mediaLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
  },
  removeMediaButton: {
    padding: theme.spacing.xs,
  },
  expandedTextInput: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.default,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  expandedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  mediaActionButton: {
    padding: theme.spacing.xs,
  },
  postButton: {
    backgroundColor: theme.colors.green,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  postButtonText: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
  loginPrompt: {
    padding: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  loginPromptText: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
  },
});
