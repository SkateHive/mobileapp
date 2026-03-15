import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import { StyleSheet, View, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState, useEffect } from "react";
import { theme } from "~/lib/theme";
import { GlobalHeader } from "~/components/ui/GlobalHeader";
import { SideMenu } from "~/components/ui/SideMenu";
import { FeedFilterProvider, useFeedFilter } from "~/lib/FeedFilterContext";
import { ScrollDirectionProvider, useScrollDirection } from "~/lib/ScrollDirectionContext";
import { Pressable, Text as RNText, Modal, Animated } from "react-native";
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
    title: "Videos",
    icon: "videocam-outline",
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12, // Lowered to look proportional
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
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
  return (
    <ScrollDirectionProvider>
      <FeedFilterProvider>
        <TabLayoutInner />
      </FeedFilterProvider>
    </ScrollDirectionProvider>
  );
}

function TabLayoutInner() {
  const router = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const segments = useSegments();
  const { username } = useAuth();
  const { hiveAccount } = useHiveAccount(username || "");
  const { scrollDirection } = useScrollDirection();

  // Animation values
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isHidden = scrollDirection === 'down';
    
    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: isHidden ? -100 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: isHidden ? 0 : 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarTranslateY, {
        toValue: isHidden ? 100 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarOpacity, {
        toValue: isHidden ? 0 : 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scrollDirection]);

  const currentTab = segments[segments.length - 1];
  const isVideosTab = currentTab === "videos";
  const isProfileTab = currentTab === "profile";
  
  const userAvatarUrl = username && username !== "SPECTATOR" 
    ? (hiveAccount?.metadata?.profile?.profile_image || `https://images.hive.blog/u/${username}/avatar/small`)
    : null;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20
        );
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 100 && gestureState.vx > 0.5) {
          router.push("/(tabs)/create");
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {!isVideosTab && (
        <Animated.View style={{ 
          transform: [{ translateY: headerTranslateY }],
          opacity: headerOpacity,
          zIndex: 10,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }}>
          <GlobalHeader 
            onOpenMenu={() => setIsMenuVisible(true)} 
            showSettings={isProfileTab}
          />
        </Animated.View>
      )}
      <View style={styles.gestureContainer} {...panResponder.panHandlers}>
        <Animated.View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: 'rgba(0,0,0,0.85)',
                borderTopColor: 'rgba(255,255,255,0.05)',
                height: 60,
                paddingBottom: 8,
                transform: [{ translateY: tabBarTranslateY }],
                opacity: tabBarOpacity,
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                elevation: 0, // Remove shadow for smooth animation
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
                          size={24}
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
        </Animated.View>
      </View>
      <SideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} />
    </View>
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
