import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { useAuth } from "~/lib/auth-provider";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationContext } from "~/lib/notifications-context";
import { BadgedIcon } from "./BadgedIcon";

interface GlobalHeaderProps {
  onOpenMenu: () => void;
  title?: string;
  centerComponent?: React.ReactNode;
}

export function GlobalHeader({ onOpenMenu, title = "Skatehive", centerComponent }: GlobalHeaderProps) {
  const router = useRouter();
  const { username } = useAuth();
  const { hiveAccount } = useHiveAccount(username || "");
  const { badgeCount } = useNotificationContext();

  const handleSearchPress = () => {
    router.push("/(tabs)/search" as any);
  };

  const handleNotificationsPress = () => {
    router.push("/(tabs)/notifications" as any);
  };

  const renderAvatar = () => {
    if (!username || username === "SPECTATOR") {
      return (
        <View style={styles.defaultAvatar}>
          <Ionicons name="person" size={20} color={theme.colors.text} />
        </View>
      );
    }

    const profileImage = hiveAccount?.metadata?.profile?.profile_image;
    const hiveAvatarUrl = `https://images.hive.blog/u/${username}/avatar/small`;

    if (profileImage) {
      return <Image source={{ uri: profileImage }} style={styles.avatar} transition={200} />;
    }

    return <Image source={{ uri: hiveAvatarUrl }} style={styles.avatar} transition={200} />;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* Left: Avatar / Menu Trigger */}
        <Pressable onPress={onOpenMenu} style={styles.leftAction} accessibilityRole="button" accessibilityLabel="Open Menu">
          {renderAvatar()}
        </Pressable>

        {/* Center: Title, Logo or Custom Component */}
        <View style={styles.centerContent}>
          {centerComponent || <Text style={styles.titleText}>{title}</Text>}
        </View>

        {/* Right: Notifications & Search */}
        <View style={styles.rightActions}>
          <Pressable 
            onPress={handleNotificationsPress} 
            style={styles.iconButton} 
            accessibilityRole="button" 
            accessibilityLabel={badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"}
          >
            <BadgedIcon name="notifications-outline" size={24} color={theme.colors.text} badgeCount={badgeCount} />
          </Pressable>
          <Pressable onPress={handleSearchPress} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Search">
            <Ionicons name="search" size={24} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: theme.spacing.md,
  },
  leftAction: {
    width: 48, // Consistent width for alignment
    height: 48,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  centerContent: {
    flex: 1,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 80,
    gap: 4, // Tighter gap for better alignment
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  defaultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
