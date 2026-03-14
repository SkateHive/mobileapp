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
  showSettings?: boolean;
}

export function GlobalHeader({ onOpenMenu, title = "Skatehive", centerComponent, showSettings }: GlobalHeaderProps) {
  const router = useRouter();
  const { badgeCount } = useNotificationContext();

  const handleSearchPress = () => {
    router.push("/(tabs)/search" as any);
  };

  const handleNotificationsPress = () => {
    router.push("/(tabs)/notifications" as any);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* Left: Notifications */}
        <View style={styles.leftAction}>
          <Pressable 
            onPress={handleNotificationsPress} 
            style={styles.iconButton} 
            accessibilityRole="button" 
            accessibilityLabel={badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"}
          >
            <BadgedIcon name="notifications-outline" size={24} color={theme.colors.text} badgeCount={badgeCount} />
          </Pressable>
        </View>

        {/* Center: Title, Logo or Custom Component */}
        <View style={styles.centerContent}>
          {centerComponent || <Text style={styles.titleText}>{title}</Text>}
        </View>

        {/* Right: Search or Settings */}
        <View style={styles.rightActions}>
          {showSettings ? (
            <Pressable 
              onPress={onOpenMenu} 
              style={styles.iconButton} 
              accessibilityRole="button" 
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
            </Pressable>
          ) : (
            <Pressable 
              onPress={handleSearchPress} 
              style={styles.iconButton} 
              accessibilityRole="button" 
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={24} color={theme.colors.text} />
            </Pressable>
          )}
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
