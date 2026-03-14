import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Dimensions, Animated, Easing, ScrollView, Alert, Clipboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from 'expo-haptics';
import { Image } from "expo-image";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { useAppSettings } from "~/lib/AppSettingsContext";
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { EditProfileModal } from "~/components/Profile/EditProfileModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

interface SideMenuProps {
  isVisible: boolean;
  onClose: () => void;
}

type MenuView = "settings" | "accounts";

export function SideMenu({ isVisible, onClose }: SideMenuProps) {
  const router = useRouter();
  const { username, logout, storedUsers, deleteStoredUser, refreshUserRelationships } = useAuth();
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { hiveAccount } = useHiveAccount(username || "");
  
  const [currentView, setCurrentView] = useState<MenuView>("settings");
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [versionColor, setVersionColor] = useState(theme.colors.muted);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewTransitionAnim = useRef(new Animated.Value(0)).current; // 0 for settings, 1 for accounts

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
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setCurrentView("settings");
        viewTransitionAnim.setValue(0);
      });
    }
  }, [isVisible]);

  const transitionTo = (view: MenuView) => {
    const toValue = view === "accounts" ? 1 : 0;
    setCurrentView(view);
    Animated.timing(viewTransitionAnim, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/");
  };

  const handleRemoveAccount = () => {
    if (!username || username === 'SPECTATOR') return;

    Alert.alert(
      "Remove Account",
      `Are you sure you want to remove @${username} from this device? You will need your posting key to log in again.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              onClose();
              await deleteStoredUser(username);
              router.replace("/");
            } catch (error) {
              console.error("Error deleting account:", error);
              showToast("Failed to remove account.", "error");
            }
          }
        }
      ]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${label} copied!`, "success");
  };

  // Helper for rendering account avatar
  const renderAvatar = (size = 40) => {
    const profileImage = hiveAccount?.metadata?.profile?.profile_image;
    const hiveAvatarUrl = `https://images.hive.blog/u/${username}/avatar/small`;
    return (
      <Image 
        source={{ uri: profileImage || hiveAvatarUrl }} 
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.secondaryCard }} 
        transition={200}
      />
    );
  };

  const renderCard = (items: { title: string, icon: any, value?: string, onPress: () => void, disabled?: boolean, color?: string, hideChevron?: boolean }[]) => (
    <View style={styles.card}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <Pressable 
            style={[styles.menuItem, item.disabled && { opacity: 0.5 }]} 
            onPress={item.onPress}
            disabled={item.disabled}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name={item.icon} size={22} color={theme.colors.primary} />
              <Text style={styles.menuItemText}>{item.title}</Text>
            </View>
            <View style={styles.menuItemRight}>
              {item.value && <Text style={styles.menuItemValue}>{item.value}</Text>}
              {!item.disabled && !item.hideChevron && <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />}
            </View>
          </Pressable>
          {index < items.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );

  const settingsItems = {
    service: [
      { title: "Scan", icon: "qr-code-outline" as const, onPress: () => {} },
      { title: "Multi-Device Login", icon: "phone-portrait-outline" as const, disabled: true, onPress: () => {} },
      { title: "Lucky Drop History", icon: "gift-outline" as const, disabled: true, onPress: () => {} },
      { title: "Viewing History", icon: "time-outline" as const, onPress: () => {} },
      { title: "Bookmarks", icon: "bookmark-outline" as const, onPress: () => {} },
      { title: "Mute List", icon: "volume-mute-outline" as const, onPress: () => {} },
      { title: "Push Notifications", icon: "notifications-outline" as const, onPress: () => {} },
    ],
    appearance: [
      { title: "Theme", icon: "color-palette-outline" as const, value: "System", hideChevron: true, onPress: () => {} },
      { title: "Language", icon: "language-outline" as const, value: "System", hideChevron: true, onPress: () => {} },
      { 
        title: "Voter", 
        icon: settings.useVoteSlider ? "options-outline" as const : "grid-outline" as const, 
        value: settings.useVoteSlider ? "Slider" : "Preset Buttons",
        onPress: () => { updateSettings({ useVoteSlider: !settings.useVoteSlider }); },
      },
      { 
        title: "Stance", 
        icon: "body-outline" as const, 
        value: settings.stance === 'regular' ? 'Regular' : 'Goofy',
        onPress: () => { updateSettings({ stance: settings.stance === 'regular' ? 'goofy' : 'regular' }); },
      },
      { title: "Feeds", icon: "list-outline" as const, value: "System", hideChevron: true, onPress: () => {} },
    ],
    about: [
      { title: "About Skatehive", icon: "information-circle-outline" as const, onPress: () => { onClose(); router.push("/about"); } },
    ]
  };

  const socialSlots = [
    { title: "X", icon: "logo-twitter" as const, value: "Coming Soon", disabled: true },
    { title: "Farcaster", icon: "cube-outline" as const, value: "Coming Soon", disabled: true },
    { title: "Lens", icon: "leaf-outline" as const, value: "Coming Soon", disabled: true },
    { title: "Bluesky", icon: "cloud-outline" as const, value: "Coming Soon", disabled: true },
    { title: "Google", icon: "logo-google" as const, value: "Coming Soon", disabled: true },
    { title: "Telegram", icon: "paper-plane-outline" as const, value: "Coming Soon", disabled: true },
    { title: "Email", icon: "mail-outline" as const, value: "Coming Soon", disabled: true },
  ];

  const renderSettingsView = () => (
    <View style={styles.viewContent}>
      <View style={styles.viewHeader}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account Entry Card */}
        <Pressable style={styles.accountCard} onPress={() => transitionTo("accounts")}>
          <View style={styles.accountCardLeft}>
            {renderAvatar(50)}
            <View style={styles.accountInfo}>
              <Text style={styles.displayName}>{hiveAccount?.metadata?.profile?.name || username}</Text>
              <Text style={styles.uid}>UID:{hiveAccount?.id || "---"}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
        </Pressable>

        {settings.isWalletUnlocked && (
          <Pressable style={styles.card} onPress={() => { onClose(); router.push("/wallet"); }}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="wallet-outline" size={22} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Wallets</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
            </View>
          </Pressable>
        )}

        {/* service section hidden per user request */}
        {/* <Text style={styles.groupLabel}>Service</Text>
        {renderCard(settingsItems.service)} */}

        <Text style={styles.groupLabel}>Appearance</Text>
        {renderCard(settingsItems.appearance)}

        <Text style={styles.groupLabel}>About</Text>
        {renderCard(settingsItems.about)}
        
        <View style={styles.versionContainer}>
          <Pressable 
            onPress={() => {
              const newCount = tapCount + 1;
              setTapCount(newCount);
              if (newCount === 5) {
                setVersionColor(theme.colors.primary);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else if (newCount === 10) {
                updateSettings({ isWalletUnlocked: true });
                showToast("Wallet Unlocked!", "success");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }}
            style={styles.versionButton}
          >
            <Text style={[styles.versionText, { color: versionColor }]}>Version 1.0.1</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  const renderAccountsView = () => (
    <View style={styles.viewContent}>
      <View style={styles.viewHeader}>
        <Pressable onPress={() => transitionTo("settings")} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Accounts</Text>
        <Pressable 
          onPress={() => setIsEditProfileVisible(true)} 
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.accountsHeader}>
          {renderAvatar(80)}
          <Pressable 
            onPress={() => copyToClipboard(username || "", "Username")}
            style={styles.accountDetailInfo}
          >
            <Text style={styles.accountsDisplayName}>{hiveAccount?.metadata?.profile?.name || username}</Text>
            <Text style={styles.accountsUid}>UID:{hiveAccount?.id || "---"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {/* Active Session */}
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="infinite-outline" size={22} color={theme.colors.text} />
              <View>
                <Text style={styles.menuItemText}>Hive</Text>
                <Text style={styles.sessionStatus}>Active Session</Text>
              </View>
            </View>
            <Text style={styles.menuItemValue}>@{username}</Text>
          </View>

          {/* Other Stored Sessions */}
          {storedUsers.filter(u => u.username !== username && u.username !== "SPECTATOR").map((user, idx) => (
            <React.Fragment key={user.username}>
              <View style={styles.divider} />
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="person-circle-outline" size={22} color={theme.colors.muted} />
                  <Text style={styles.menuItemText}>@{user.username}</Text>
                </View>
                <Text style={styles.menuItemValue}>Stored</Text>
              </View>
            </React.Fragment>
          ))}

          <View style={styles.divider} />
          <Pressable style={styles.menuItem} onPress={() => { onClose(); router.push("/login"); }}>
            <Text style={styles.menuItemTextSecondary}>Add Hive Account</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
          </Pressable>
        </View>

        {socialSlots.map((slot, idx) => (
          <View key={idx} style={[styles.card, { marginTop: theme.spacing.md }]}>
             <View style={[styles.menuItem, { opacity: 0.5 }]}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={slot.icon} size={22} color={theme.colors.text} />
                <Text style={styles.menuItemText}>{slot.title}</Text>
              </View>
              <Text style={styles.menuItemValue}>{slot.value}</Text>
            </View>
          </View>
        ))}

        <View style={styles.footerActions}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
          
          <Pressable style={styles.removeButton} onPress={handleRemoveAccount}>
            <Text style={styles.removeButtonText}>Remove from Device</Text>
          </Pressable>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  if (!isVisible && slideAnim.addListener === undefined) return null;

  const translateX = viewTransitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -DRAWER_WIDTH],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.drawer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.multiViewContainer, { transform: [{ translateX }] }]}>
            {renderSettingsView()}
            {renderAccountsView()}
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      <EditProfileModal
        visible={isEditProfileVisible}
        onClose={() => setIsEditProfileVisible(false)}
        currentProfile={hiveAccount?.metadata?.profile || {}}
        onSaved={() => {
          refreshUserRelationships();
        }}
      />
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
    width: DRAWER_WIDTH,
    backgroundColor: theme.colors.background,
    zIndex: 101,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    overflow: "hidden", // Prevent multi-view bleed
  },
  safeArea: {
    flex: 1,
  },
  multiViewContainer: {
    flex: 1,
    flexDirection: "row",
    width: DRAWER_WIDTH * 2,
  },
  viewContent: {
    width: DRAWER_WIDTH,
    flex: 1,
  },
  viewHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  editButton: {
    padding: theme.spacing.sm,
  },
  editButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  accountCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  accountInfo: {
    gap: 2,
  },
  displayName: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  uid: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  groupLabel: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
    textTransform: "uppercase",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    justifyContent: "space-between",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  menuItemText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  sessionStatus: {
    fontSize: 10,
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    textTransform: "uppercase",
  },
  menuItemTextSecondary: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  menuItemValue: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 54,
  },
  accountsHeader: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  accountDetailInfo: {
    alignItems: "center",
  },
  accountsDisplayName: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  accountsUid: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
  },
  footerActions: {
    marginTop: theme.spacing.xxxl,
    gap: theme.spacing.lg,
    alignItems: "center",
  },
  logoutButton: {
    width: "100%",
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
  },
  logoutButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
  },
  removeButton: {
    padding: theme.spacing.sm,
  },
  removeButtonText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  versionContainer: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
    paddingBottom: theme.spacing.lg,
  },
  versionButton: {
    padding: theme.spacing.sm,
  },
  versionText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
  },
});
