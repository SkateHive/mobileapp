import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { StyleSheet, View, PanResponder } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useRef } from "react";
import { theme } from "~/lib/theme";

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
    name: "feed",
    title: "Feed",
    icon: "reader-outline",
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

export default function TabLayout() {
  const router = useRouter();

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

  return (
    <SafeAreaProvider>
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
                  ...(tab.name === "profile" && {
                    href: {
                      pathname: "/(tabs)/profile",
                      params: {},
                    },
                  }),
                }}
              />
            ))}

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
      </SafeAreaView>
    </SafeAreaProvider>
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
