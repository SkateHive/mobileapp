import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { StyleSheet, View, PanResponder, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { theme } from "~/lib/theme";
import { Text } from "~/components/ui/text";
import { ErrorBoundary } from "~/components/ui/ErrorBoundary";

interface TabItem {
  name: string;
  title: string;
  icon: string;
  iconFamily: "Ionicons";
  isCenter?: boolean;
}

const TAB_ITEMS: TabItem[] = [
  {
    name: "videos",
    title: "Videos",
    icon: "home-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "map",
    title: "Map",
    icon: "map-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "create",
    title: "Create",
    icon: "add",
    iconFamily: "Ionicons",
    isCenter: true,
  },
  {
    name: "leaderboard",
    title: "Leaderboard",
    icon: "podium-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    iconFamily: "Ionicons",
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gestureContainer: {
    flex: 1,
  },
  centerButtonContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.background,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  // Drop-up anchored above the center "+" button
  createMenuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 96, // clears the 60px tab bar + the button's upward float
  },
  createMenuCard: {
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minWidth: 180,
    overflow: "hidden",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  createMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  createMenuText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  createMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  createMenuPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme.colors.secondaryCard,
    marginTop: -1,
  },
});

export default function TabLayout() {
  const router = useRouter();
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  const openCreateMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreateMenuVisible(true);
  };

  const handleMenuChoice = (target: "/(tabs)/create" | "/spot-create") => {
    setCreateMenuVisible(false);
    router.push(target);
  };

  // Create swipe gesture using PanResponder (simpler, less likely to crash)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20
        );
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Detect swipe from left to right
        if (gestureState.dx > 100 && gestureState.vx > 0.5) {
          router.push("/(tabs)/create");
        }
      },
    })
  ).current;

  return (
    <ErrorBoundary>
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.gestureContainer} {...panResponder.panHandlers}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                height: 60,
                paddingBottom: 8,
              },
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: theme.colors.gray,
              tabBarShowLabel: false,
              sceneStyle: { backgroundColor: theme.colors.background },
            }}
          >
            {TAB_ITEMS.map((tab) => (
              <Tabs.Screen
                key={tab.name}
                name={tab.name}
                listeners={
                  tab.isCenter
                    ? {
                        tabPress: (e) => {
                          e.preventDefault();
                          openCreateMenu();
                        },
                      }
                    : undefined
                }
                options={{
                  title: tab.title,
                  tabBarIcon: ({ color, focused }) =>
                    tab.isCenter ? (
                      <View style={styles.centerButtonContainer}>
                        <Ionicons
                          name="add"
                          size={32}
                          color={theme.colors.primary}
                        />
                      </View>
                    ) : (
                      <TabBarIcon
                        name={tab.icon}
                        color={color}
                        iconFamily={tab.iconFamily}
                      />
                    ),
                  // Unmount videos tab when switching away to free native video player memory
                  ...(tab.name === "videos" && {
                    unmountOnBlur: true,
                  }),
                  ...(tab.name === "profile" && {
                    href: {
                      pathname: "/(tabs)/profile",
                      params: {},
                    },
                  }),
                }}
              />
            ))}

            {/* Hidden feed tab - accessible from the videos/home top-right button */}
            <Tabs.Screen
              name="feed"
              options={{
                href: null,
                title: "Feed",
              }}
            />

            {/* Hidden notifications tab - accessible from header */}
            <Tabs.Screen
              name="notifications"
              options={{
                href: null,
                title: "Notifications",
              }}
            />
          </Tabs>
        </View>

        {/* Drop-up shown when the center "+" is tapped */}
        <Modal
          visible={createMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCreateMenuVisible(false)}
        >
          <Pressable
            style={styles.createMenuOverlay}
            onPress={() => setCreateMenuVisible(false)}
          >
            <View style={styles.createMenuCard}>
              <Pressable
                style={styles.createMenuItem}
                onPress={() => handleMenuChoice("/(tabs)/create")}
              >
                <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.createMenuText}>Post</Text>
              </Pressable>
              <View style={styles.createMenuDivider} />
              <Pressable
                style={styles.createMenuItem}
                onPress={() => handleMenuChoice("/spot-create")}
              >
                <Ionicons name="location-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.createMenuText}>Spot</Text>
              </Pressable>
            </View>
            {/* Pointer triangle aimed at the center button */}
            <View style={styles.createMenuPointer} />
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function TabBarIcon(props: {
  name: string;
  color: string;
  iconFamily: "Ionicons";
}) {
  const { name, color } = props;

  return (
    <Ionicons
      name={name as any}
      size={24}
      color={color}
      style={{ marginBottom: -10 }}
    />
  );
}
