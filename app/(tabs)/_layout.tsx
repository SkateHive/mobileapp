import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { StyleSheet, View, PanResponder, TouchableOpacity } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useRef } from "react";
import { theme } from "~/lib/theme";
import { BadgedIcon } from "~/components/ui/BadgedIcon";
import { useNotificationContext } from "~/lib/notifications-context";

const TAB_ITEMS = [
  {
    name: "feed",
    title: "Feed",
    icon: "home-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "videos",
    title: "Videos",
    icon: "film-outline",
    iconFamily: "Ionicons",
  },
  {
    name: "leaderboard",
    title: "Leaderboard",
    icon: "podium-outline",
    iconFamily: "Ionicons",
  },
  // Wallet tab temporarily disabled for App Store review
  // Will be re-enabled in future update with enhanced functionality
  // {
  //   name: "wallet",
  //   title: "Wallet",
  //   icon: "wallet-outline",
  //   iconFamily: "Ionicons",
  // },
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
  const { badgeCount } = useNotificationContext();

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
    floatingButton: {
      position: 'absolute',
      bottom: 100,
      right: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#000',
      borderWidth: 3,
      borderColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      zIndex: 1000,
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
                      badgeCount={tab.name === "notifications" ? badgeCount : 0}
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
            
            {/* Hidden create tab - still accessible but not in tab bar */}
            <Tabs.Screen
              name="create"
              options={{
                href: null,
                title: "Create",
              }}
            />
          </Tabs>
          
          {/* Floating Create Button */}
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => router.push("/(tabs)/create")}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={40} color={theme.colors.primary} style={{ fontWeight: 'bold' }} />
          </TouchableOpacity>
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
