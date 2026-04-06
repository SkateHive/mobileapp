import React, { useRef, useEffect } from "react";
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { PostCard } from "./PostCard";
import { ReplyComposer } from "~/components/ui/ReplyComposer";
import { useReplies } from "~/lib/hooks/useReplies";
import { useAuth } from "~/lib/auth-provider";
import { theme } from "~/lib/theme";
import type { Discussion } from "@hiveio/dhive";
import type { NestedDiscussion } from "~/lib/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface FullConversationDrawerProps {
  visible: boolean;
  onClose: () => void;
  author: string;
  permlink: string;
  discussion?: Discussion; // optional — if provided, renders the original post card at the top
  partial?: boolean; // when true, drawer occupies 80% height anchored to the bottom
}

export function FullConversationDrawer({
  visible,
  onClose,
  author,
  permlink,
  discussion,
  partial,
}: FullConversationDrawerProps) {
  const { username } = useAuth();
  const insets = useSafeAreaInsets();
  const { comments, isLoading, error } = useReplies(
    author,
    permlink,
    visible, // Only fetch when visible
  );

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
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
    });
  };

  // Recursive function to render all nested replies as PostCards with only 1 level of indentation
  const renderNestedReplies = (
    replies: NestedDiscussion[],
    depth: number = 0,
  ): React.ReactElement[] => {
    return replies.map((reply, index) => (
      <View key={`${reply.author}/${reply.permlink}-${depth}-${index}`}>
        {/* Add indentation only for depth > 0 (replies to replies) */}
        <View style={depth > 0 ? styles.indentedReply : undefined}>
          {/* Each reply is a full PostCard. PostCard now accepts NestedDiscussion as well as Discussion. */}
          <PostCard post={reply} currentUsername={username} />
        </View>
        {/* Recursively render nested replies - they'll all get the same indentation */}
        {reply.replies && reply.replies.length > 0 && (
          <View>{renderNestedReplies(reply.replies, depth + 1)}</View>
        )}

        {/* Separator between same-level replies */}
        {index < replies.length - 1 && <View style={styles.separator} />}
      </View>
    ));
  };

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
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPress} onPress={handleClose} />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            partial && styles.drawerPartial,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={partial ? 0 : insets.top}
          >
            {/* Header with safe area padding */}
            <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
              <View style={styles.header}>
                <Pressable onPress={handleClose} style={styles.backButton}>
                  <Ionicons
                    name="arrow-back"
                    size={24}
                    color={theme.colors.text}
                  />
                </Pressable>
                <Text style={styles.headerTitle}>Conversation</Text>
                <View style={styles.headerSpacer} />
              </View>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Original Post */}
              {discussion && (
                <View style={styles.mainPost}>
                  <PostCard post={discussion} currentUsername={username} />
                </View>
              )}

              <View style={styles.divider} />

              {/* All Replies (Recursive) */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.green} />
                  <Text style={styles.loadingText}>
                    Loading conversation...
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    Error loading conversation
                  </Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No comments yet</Text>
                </View>
              ) : (
                <View style={styles.repliesContainer}>
                  {renderNestedReplies(comments)}
                </View>
              )}
            </ScrollView>

            {/* Reply Box at Bottom */}
            {username && username !== "SPECTATOR" && (
              <View
                style={[
                  styles.replySection,
                  { paddingBottom: insets.bottom || theme.spacing.md },
                ]}
              >
                <ReplyComposer
                  parentAuthor={author}
                  parentPermlink={permlink}
                  onReplySuccess={() => {}}
                  placeholder="Write your reply..."
                  buttonLabel="POST"
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
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: theme.colors.background,
  },
  drawerPartial: {
    top: undefined,
    height: SCREEN_HEIGHT * 0.8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: theme.colors.background,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontWeight: "bold",
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  mainPost: {
    backgroundColor: theme.colors.card,
  },
  divider: {
    height: 8,
    backgroundColor: theme.colors.background,
  },
  repliesContainer: {
    backgroundColor: theme.colors.card,
  },
  nestedContainer: {
    backgroundColor: theme.colors.card,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  loadingContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
  },
  errorContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.sm,
  },
  emptyContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
    textAlign: "center",
  },
  safeArea: {
    flex: 1,
  },
  indentedReply: {
    marginLeft: theme.spacing.md,
  },
  replySection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
});
