import React from "react";
import { View, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/text";
import { theme } from "~/lib/theme";
import type { UserbaseNotification } from "~/lib/userbase/api";

interface CrosspostNotificationItemProps {
  notification: UserbaseNotification;
}

const ICONS: Record<string, { name: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  crosspost_queued: { name: "time-outline", color: theme.colors.muted },
  crosspost_rejected: { name: "close-circle-outline", color: theme.colors.danger },
  crosspost_published: { name: "checkmark-circle-outline", color: theme.colors.primary },
  crosspost_failed: { name: "alert-circle-outline", color: theme.colors.danger },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;

  return date.toLocaleDateString();
}

/** Instagram curation-queue notifications: queued / rejected / published / failed. */
export const CrosspostNotificationItem = React.memo(
  ({ notification }: CrosspostNotificationItemProps) => {
    const icon = ICONS[notification.type] ?? ICONS.crosspost_queued;
    const reviewNote =
      typeof notification.metadata?.review_note === "string" ? notification.metadata.review_note : null;
    const igPermalink =
      typeof notification.metadata?.ig_permalink === "string" ? notification.metadata.ig_permalink : null;
    // A published notification opens the Instagram post itself when we have
    // it; anything else falls back to the Hive permalink the server sent.
    const openUrl = igPermalink || notification.link;
    const isUnread = notification.read_at === null;

    const handlePress = () => {
      if (openUrl) Linking.openURL(openUrl).catch(() => {});
    };

    return (
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={handlePress}
        disabled={!openUrl}
      >
        {isUnread && <View style={styles.unreadIndicator} />}

        <View style={styles.iconContainer}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, isUnread && styles.unreadText]} numberOfLines={2}>
            {notification.title}
          </Text>
          {(reviewNote || notification.body) && (
            <Text style={styles.body} numberOfLines={3}>
              {reviewNote ?? notification.body}
            </Text>
          )}
          <Text style={styles.date}>{formatDate(notification.created_at)}</Text>
        </View>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: "flex-start",
    position: "relative",
  },
  pressed: {
    backgroundColor: theme.colors.secondaryCard,
  },
  unreadIndicator: {
    position: "absolute",
    right: theme.spacing.md,
    top: theme.spacing.md + 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    zIndex: 1,
  },
  iconContainer: {
    marginRight: theme.spacing.sm,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.regular,
  },
  unreadText: {
    fontFamily: theme.fonts.bold,
  },
  body: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
  },
  date: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.regular,
  },
});
