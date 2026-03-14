import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import { StyleSheet, View, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import { theme } from "~/lib/theme";
import { GlobalHeader } from "~/components/ui/GlobalHeader";
import { SideMenu } from "~/components/ui/SideMenu";
import { FeedFilterProvider, useFeedFilter } from "~/lib/FeedFilterContext";
import { Pressable, Text as RNText, Modal } from "react-native";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { useAppSettings } from "~/lib/AppSettingsContext";
import useHiveAccount from "~/lib/hooks/useHiveAccount";
import { Image } from "expo-image";

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
    title: "Skatehive",
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
  avatarContainer: {
    marginBottom: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
});

function FeedHeaderTitle() {
  const { filter, setFilter } = useFeedFilter();
  const [showDropdown, setShowDropdown] = useState(false);

  const filters: ('Recent' | 'Following' | 'Curated' | 'Trending')[] = ['Recent', 'Following', 'Curated', 'Trending'];

  return (
    <View>
      <Pressable onPress={() => setShowDropdown(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: theme.fontSizes.lg, fontFamily: theme.fonts.bold, color: theme.colors.text }}>
          {filter}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.text} style={{ marginLeft: 4 }} />
      </Pressable>

      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowDropdown(false)}
        >
          <View style={{ backgroundColor: theme.colors.secondaryCard, borderRadius: 12, padding: 8, width: 200, borderWidth: 1, borderColor: theme.colors.border }}>
            {filters.map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  setFilter(f);
                  setShowDropdown(false);
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: filter === f ? 'rgba(50, 205, 50, 0.1)' : 'transparent',
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text style={{ 
                  color: filter === f ? theme.colors.primary : theme.colors.text,
                  fontFamily: filter === f ? theme.fonts.bold : theme.fonts.regular 
                }}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const segments = useSegments();
  const { username } = useAuth();
  const { hiveAccount } = useHiveAccount(username || "");

  const currentTab = segments[segments.length - 1];
  const isVideosTab = currentTab === "videos";
  const isProfileTab = currentTab === "profile";
  
  const userAvatarUrl = username && username !== "SPECTATOR" 
    ? (hiveAccount?.metadata?.profile?.profile_image || `https://images.hive.blog/u/${username}/avatar/small`)
    : null;
  
  // Determine header title based on active tab
  const getHeaderTitle = () => {
    const currentTab = segments[segments.length - 1];
    
    switch (currentTab) {
      case "videos":
        return "Skatehive";
      case "feed":
        return "Skatehive";
      case "create":
        return "Skatehive Create";
      case "leaderboard":
        return "Leaderboard";
      case "profile":
        return "Profile";
      default:
        return "Skatehive";
    }
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
    <FeedFilterProvider>
      <View style={styles.container}>
        {!isVideosTab && (
          <GlobalHeader 
            onOpenMenu={() => setIsMenuVisible(true)} 
            // title={getHeaderTitle()}
            // centerComponent={currentTab === "feed" ? <FeedHeaderTitle /> : undefined} // Future feature: Filter dropdown
            showSettings={isProfileTab}
          />
        )}
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
                  unmountOnBlur: tab.name === 'videos' || tab.name === 'feed',
                  title: tab.title,
                  tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) =>
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
                        avatarUrl={tab.name === "profile" ? userAvatarUrl : undefined}
                      />
                    ),
                  ...(tab.name === "profile" && {
                    href: {
                      pathname: "/(tabs)/profile",
                      params: {},
                    },
                  }),
                } as any}
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
            
            {/* Hidden search tab - accessible from header */}
            <Tabs.Screen
              name="search"
              options={{
                href: null,
                title: "Search",
              }}
            />
          </Tabs>
        </View>
        <SideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} />
      </View>
    </FeedFilterProvider>
  );
}

function TabBarIcon(props: {
  name: string;
  color: string;
  iconFamily: "Ionicons";
  avatarUrl?: string | null;
}) {
  const { name, color, avatarUrl } = props;

  if (avatarUrl) {
    return (
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: avatarUrl }} 
          style={[styles.tabAvatar, { borderColor: color === theme.colors.primary ? theme.colors.primary : 'transparent' }]} 
          transition={200}
        />
      </View>
    );
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
