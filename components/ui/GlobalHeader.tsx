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

interface GlobalHeaderProps {
  onOpenMenu: () => void;
  title?: string;
}

export function GlobalHeader({ onOpenMenu, title = "Skatehive" }: GlobalHeaderProps) {
  const router = useRouter();
  const { username } = useAuth();
  const { hiveAccount } = useHiveAccount(username || "");

  const handleSearchPress = () => {
    router.push("/(tabs)/search" as any);
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

        {/* Center: Title or Logo */}
        <View style={styles.centerContent}>
          <Text style={styles.titleText}>{title}</Text>
        </View>

        {/* Right: Search */}
        <Pressable onPress={handleSearchPress} style={styles.rightAction} accessibilityRole="button" accessibilityLabel="Search">
          <Ionicons name="search" size={24} color={theme.colors.text} />
        </Pressable>
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
    width: 40,
    alignItems: "flex-start",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
  },
  rightAction: {
    width: 40,
    alignItems: "flex-end",
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
