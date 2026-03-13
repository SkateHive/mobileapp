import React from "react";
import { View, StyleSheet, Pressable, Dimensions, Animated, Easing, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { theme } from "~/lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SideMenuProps {
  isVisible: boolean;
  onClose: () => void;
}

export function SideMenu({ isVisible, onClose }: SideMenuProps) {
  const router = useRouter();
  const { username, logout } = useAuth();
  
  // Animation value for sliding in/out
  const slideAnim = React.useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
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
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH * 0.75,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isVisible, slideAnim, fadeAnim]);

  if (!isVisible && slideAnim.addListener === undefined) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/");
  };

  const accountItems = [
    { title: "Sign in with Twitter (X)", icon: "logo-twitter" as const, onPress: () => { onClose(); } },
    { title: "Farcaster", icon: "cube-outline" as const, onPress: () => { onClose(); } },
    { title: "Lens", icon: "leaf-outline" as const, onPress: () => { onClose(); } },
    { title: "Bluesky", icon: "cloud-outline" as const, onPress: () => { onClose(); } },
    { title: "Google", icon: "logo-google" as const, onPress: () => { onClose(); } },
    { title: "Telegram", icon: "paper-plane-outline" as const, onPress: () => { onClose(); } },
    { title: "Email", icon: "mail-outline" as const, onPress: () => { onClose(); } },
    { title: "Edit Profile", icon: "create-outline" as const, onPress: () => { onClose(); } },
  ];

  const walletItems = [
    { title: "Add Wallet", icon: "wallet-outline" as const, onPress: () => { onClose(); } },
  ];

  const serviceItems = [
    { title: "Mute List", icon: "volume-mute-outline" as const, onPress: () => { onClose(); } },
    { title: "Push Notifications", icon: "notifications-outline" as const, onPress: () => { onClose(); } },
    { title: "Scan", icon: "qr-code-outline" as const, onPress: () => { onClose(); } },
  ];

  const appearanceItems = [
    { title: "Theme", icon: "color-palette-outline" as const, onPress: () => { onClose(); } },
    { title: "Language", icon: "language-outline" as const, onPress: () => { onClose(); } },
    { title: "Feeds", icon: "list-outline" as const, onPress: () => { onClose(); } },
    { title: "Explore", icon: "compass-outline" as const, onPress: () => { onClose(); } },
  ];

  const aboutItems = [
    { title: "About SkateHive", icon: "information-circle-outline" as const, onPress: () => { onClose(); } },
    { title: "Support", icon: "help-circle-outline" as const, onPress: () => { onClose(); } },
    { title: "Privacy Policy", icon: "shield-checkmark-outline" as const, onPress: () => { onClose(); } },
    { title: "Terms of Service", icon: "document-text-outline" as const, onPress: () => { onClose(); } },
  ];

  const renderSection = (title: string, items: { title: string, icon: any, onPress: () => void }[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <Pressable key={index} style={styles.menuItem} onPress={item.onPress}>
          <Ionicons name={item.icon} size={22} color={theme.colors.text} />
          <Text style={styles.menuItemText}>{item.title}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
      <Animated.View 
        style={[styles.backdrop, { opacity: fadeAnim }]} 
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.drawer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.username}>@{username}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          
          <ScrollView style={styles.menuItems} showsVerticalScrollIndicator={false}>
            {renderSection("ACCOUNT", accountItems)}
            {renderSection("WALLET", walletItems)}
            {renderSection("SERVICE", serviceItems)}
            {renderSection("APPEARANCE", appearanceItems)}
            {renderSection("ABOUT", aboutItems)}
          </ScrollView>
          
          <View style={styles.footer}>
            <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={theme.colors.danger} />
              <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Logout</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 100,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: theme.colors.card,
    zIndex: 101,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: {
      width: 5,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  username: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  menuItems: {
    flex: 1,
  },
  section: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  menuItemText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  footer: {
    paddingVertical: theme.spacing.md,
  },
  logoutItem: {
    marginTop: theme.spacing.sm,
  },
});
