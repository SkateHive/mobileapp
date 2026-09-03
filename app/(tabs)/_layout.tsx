import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { StyleSheet, View, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { theme } from "~/lib/theme";
import { ErrorBoundary } from "~/components/ui/ErrorBoundary";
import { useAuth } from "~/lib/auth-provider";
import { canPost } from "~/lib/posting";
import { useNotificationContext } from "~/lib/notifications-context";
import { ActionSheet } from "~/components/ui/ActionSheet";
import { UploadPill } from "~/components/upload/UploadPill";

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
    name: "notifications",
    title: "Notifications",
    icon: "notifications-outline",
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
});

export default function TabLayout() {
  const router = useRouter();
  const { session, username } = useAuth();
  const { badgeCount } = useNotificationContext();
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  // Logged-out / spectator users can't post — send them to login instead of
  // the create flow.
  const requireAuth = (): boolean => {
    if (canPost(session)) return true;
    Haptics.selectionAsync();
    router.push("/login");
    return false;
  };

  const openCreateMenu = () => {
    if (!requireAuth()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreateMenuVisible(true);
  };

  // The PanResponder below is created once, so read auth through a live ref.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const handleMenuChoice = (
    target: "/(tabs)/create" | "/spot-create" | "/skate-dice",
  ) => {
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
          if (canPost(sessionRef.current)) router.push("/(tabs)/create");
          else router.push("/login");
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
                  // Unread badge now lives on the notifications tab.
                  ...(tab.name === "notifications" &&
                    badgeCount > 0 && {
                      tabBarBadge: badgeCount,
                      tabBarBadgeStyle: {
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.black,
                        fontSize: 10,
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

            {/* Hidden leaderboard tab - now opened from the forum/feed header */}
            <Tabs.Screen
              name="leaderboard"
              options={{
                href: null,
                title: "Leaderboard",
              }}
            />
          </Tabs>

          {/* Background upload progress. A sibling of <Tabs> so it survives
              tab switches and sits above the bar; absent on stack screens. */}
          <UploadPill />
        </View>

        {/* Variant-C action sheet shown when the center "+" is tapped */}
        <ActionSheet
          visible={createMenuVisible}
          onClose={() => setCreateMenuVisible(false)}
          title="Create"
          subtitle={username ? `@${username}` : undefined}
          items={[
            {
              key: "post",
              icon: "create-outline",
              title: "Post",
              subtitle: "Share a clip with the crew",
              variant: "primary",
              onPress: () => handleMenuChoice("/(tabs)/create"),
            },
            {
              key: "spot",
              icon: "location-outline",
              title: "Spot",
              subtitle: "Add a skate spot to the map",
              variant: "secondary",
              onPress: () => handleMenuChoice("/spot-create"),
            },
            {
              key: "play",
              icon: "game-controller-outline",
              title: "Play",
              subtitle: "Coach Fred — skate or dice",
              variant: "secondary",
              onPress: () => handleMenuChoice("/skate-dice"),
            },
          ]}
        />
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
