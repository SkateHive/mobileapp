import React, { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { ReplyComposer } from "~/components/ui/ReplyComposer";
import { theme } from "~/lib/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CommentBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  parentAuthor: string;
  parentPermlink: string;
  onReplySuccess?: (newReply: any) => void;
}

export function CommentBottomSheet({
  isVisible,
  onClose,
  parentAuthor,
  parentPermlink,
  onReplySuccess,
}: CommentBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, fadeAnim]);

  if (!isVisible && slideAnim.addListener === undefined) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Bottom Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Comments</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <Text style={styles.replyingToText}>
              Replying to <Text style={styles.replyingToAuthor}>@{parentAuthor}</Text>
            </Text>
            
            <ReplyComposer
              parentAuthor={parentAuthor}
              parentPermlink={parentPermlink}
              onReplySuccess={(newReply) => {
                if (onReplySuccess) onReplySuccess(newReply);
                onClose();
              }}
              placeholder="Add a comment..."
              buttonLabel="Post"
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 100,
  },
  keyboardAvoidingView: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 101,
  },
  sheetContainer: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.5,
    paddingBottom: theme.spacing.xl, // Extra padding for safe area
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: "center",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  headerTitle: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  closeButton: {
    position: "absolute",
    right: theme.spacing.md,
    top: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.md,
  },
  replyingToText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  replyingToAuthor: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
  },
});
