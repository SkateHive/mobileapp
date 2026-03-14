import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/text';
import { PostCard } from './PostCard';
import { ConversationReply } from './ConversationReply';
import { ReplyComposer } from '../ui/ReplyComposer';
import { useReplies } from '~/lib/hooks/useReplies';
import { useAuth } from '~/lib/auth-provider';
import { getContent } from '~/lib/hive-utils';
import { useScrollLock } from '~/lib/ScrollLockContext';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConversationDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  post?: Discussion;
  author?: string;
  permlink?: string;
}

export function ConversationDrawer({
  isVisible,
  onClose,
  post: initialPost,
  author: initialAuthor,
  permlink: initialPermlink,
}: ConversationDrawerProps) {
  const insets = useSafeAreaInsets();
  const { username } = useAuth();
  const { isScrollLocked } = useScrollLock();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  
  const [post, setPost] = useState<Discussion | undefined>(initialPost);
  const [isPostLoading, setIsPostLoading] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const author = post?.author || initialAuthor || '';
  const permlink = post?.permlink || initialPermlink || '';

  const { comments, isLoading: isCommentsLoading, error, refetch } = useReplies(
    author,
    permlink,
    isVisible && !!author && !!permlink
  );

  useEffect(() => {
    if (isVisible && !post && initialAuthor && initialPermlink) {
      const fetchPost = async () => {
        setIsPostLoading(true);
        const fetchedPost = await getContent(initialAuthor, initialPermlink);
        if (fetchedPost) {
          setPost(fetchedPost);
        }
        setIsPostLoading(false);
      };
      fetchPost();
    }
  }, [isVisible, initialAuthor, initialPermlink, post]);

  const [optimisticReplies, setOptimisticReplies] = useState<Discussion[]>([]);

  useEffect(() => {
    if (isVisible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
      setOptimisticReplies([]); // Reset optimistic replies when drawer opens
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes when at the top of the scroll
        return gestureState.dy > 10 && scrollOffset <= 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Detect fast flicks down (positive velocity) or significant distance
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const handleReplySuccess = (newReply: Discussion) => {
    setOptimisticReplies((prev) => [newReply, ...prev]);
  };

  const allReplies = [...optimisticReplies, ...comments];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.drawer,
            {
              transform: [{ translateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Gesture Sensitive Header Area */}
          <View>
            {/* Handle bar for swiping */}
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>

            {/* Sticky Header: Original Post Context */}
            <View style={styles.stickyHeader}>
              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle}>Conversation</Text>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </Pressable>
              </View>
              
              {/* Minimal post preview for context */}
              <View style={styles.postContext}>
                {isPostLoading ? (
                  <View style={styles.postLoadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : post ? (
                  <PostCard 
                    post={post} 
                    currentUsername={username} 
                    isStatic
                  />
                ) : null}
              </View>
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={styles.repliesList}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isScrollLocked}
              onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
            >
              <View style={styles.repliesHeader}>
                <Text style={styles.repliesTitle}>
                  {post?.children || 0} Comments
                </Text>
                {(isCommentsLoading || isPostLoading) && (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                )}
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Error: {error}</Text>
                  <Pressable onPress={refetch} style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (allReplies || []).length === 0 && !(isCommentsLoading || isPostLoading) ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                </View>
              ) : (
                (allReplies || []).map((reply, index) => (
                  <View key={`${reply.author}-${reply.permlink}-${index}`} style={styles.replyWrapper}>
                    <ConversationReply
                      post={reply as unknown as any}
                      currentUsername={username}
                      onReplySuccess={handleReplySuccess}
                    />
                  </View>
                ))
              )}
            </ScrollView>

            {/* Bottom composer always visible */}
            {post && (
              <View style={styles.composerWrapper}>
                <ReplyComposer
                  parentAuthor={post.author}
                  parentPermlink={post.permlink}
                  onReplySuccess={handleReplySuccess}
                  placeholder={`Reply to @${post.author}...`}
                />
              </View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  drawer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.9,
    width: '100%',
    overflow: 'hidden',
  },
  postLoadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBarContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  stickyHeader: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  postContext: {
    maxHeight: 200, // Limit height of the sticky post context
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  container: {
    flex: 1,
  },
  repliesList: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for composer
  },
  repliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: theme.colors.card,
  },
  repliesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  replyWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  composerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#000',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 16,
  },
});
