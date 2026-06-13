import { router } from "expo-router";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { theme } from "~/lib/theme";

/**
 * Spectator (logged-out, read-only) profile body. Kept deliberately simple:
 * log in, or go back to browsing the feed.
 */
export function ProfileSpectatorInfo() {
  const { logout } = useAuth();

  const goToLogin = async () => {
    Haptics.selectionAsync();
    // Leave spectator mode so the welcome screen shows the login form instead
    // of bouncing an "authenticated" spectator back into the tabs.
    try {
      await logout();
    } catch {
      // ignore — navigation below still lands on the login screen
    }
    router.replace("/");
  };

  const backToFeed = () => {
    Haptics.selectionAsync();
    router.replace("/(tabs)/videos");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SPECTATOR MODE</Text>
      <Text style={styles.subtitle}>
        You're browsing read-only. Log in to vote, post and earn — or keep
        cruising the feed.
      </Text>

      <Pressable
        style={styles.primaryBtn}
        onPress={goToLogin}
        accessibilityRole="button"
        accessibilityLabel="Log in"
      >
        <Ionicons name="log-in-outline" size={18} color={theme.colors.black} />
        <Text style={styles.primaryText}>LOG IN</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryBtn}
        onPress={backToFeed}
        accessibilityRole="button"
        accessibilityLabel="Back to feed"
      >
        <Ionicons name="arrow-back" size={18} color={theme.colors.primary} />
        <Text style={styles.secondaryText}>BACK TO FEED</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    width: "100%",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.black,
    letterSpacing: 1,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    width: "100%",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
});
