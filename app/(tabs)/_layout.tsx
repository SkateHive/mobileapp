import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { StyleSheet, View, PanResponder } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useRef } from "react";
import { theme } from "~/lib/theme";
import { BadgedIcon } from "~/components/ui/BadgedIcon";
import { useNotifications } from "~/lib/hooks/useNotifications";

const TAB_ITEMS = [
  {
    name: "feed",
    title: "Feed",
    icon: "home-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "leaderboard",
    title: "Leaderboard",
    icon: "podium-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "create",
    title: "Create",
    icon: "add-circle-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "wallet",
    title: "Wallet",
    icon: "wallet-outline",
    iconFamily: "Ionicons",
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
] as const;

export default function TabLayout() {
  const router = useRouter();
  const { unreadCount } = useNotifications();

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    gestureContainer: {
      flex: 1,
    },
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.gestureContainer} {...panResponder.panHandlers}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.background,
              },
              tabBarActiveTintColor: theme.colors.text,
              tabBarInactiveTintColor: theme.colors.gray,
              tabBarShowLabel: false,
              sceneStyle: { backgroundColor: theme.colors.background },
            }}
          >
            {TAB_ITEMS.map((tab) => (
              <Tabs.Screen
                key={tab.name}
                name={tab.name}
                options={{
                  title: tab.title,
                  tabBarIcon: ({ color }) => (
                    <TabBarIcon
                      name={tab.icon}
                      color={color}
                      iconFamily={tab.iconFamily}
                      showBadge={tab.name === "notifications"}
                      badgeCount={
                        tab.name === "notifications" ? unreadCount : 0
                      }
                    />
                  ),
                  ...(tab.name === "profile" && {
                    href: {
                      pathname: "/(tabs)/profile",
                      params: {},
                    },
                  }),
                }}
              />
            ))}
          </Tabs>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TabBarIcon(props: {
  name: string;
  color: string;
  iconFamily: "Ionicons";
  showBadge?: boolean;
  badgeCount?: number;
}) {
  const { name, color, showBadge = false, badgeCount = 0 } = props;

  if (showBadge) {
    return <BadgedIcon name={name} color={color} badgeCount={badgeCount} />;
  }

  return (
    <Ionicons
      name={name as any}
      size={24}
      color={color}
      style={{ marginBottom: -10 }}
    />
  );
}
