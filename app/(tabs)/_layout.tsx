import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '~/lib/theme';

const TAB_ITEMS = [
  {
    name: 'feed',
    title: 'Feed',
    icon: 'home-outline',
    iconFamily: 'Ionicons'
  },
  {
    name: 'leaderboard',
    title: 'Leaderboard',
    icon: 'podium-outline',
    iconFamily: 'Ionicons'
  },
  {
    name: 'create',
    title: 'Create',
    icon: 'add-circle-outline',
    iconFamily: 'Ionicons'
  },
  {
    name: 'wallet',
    title: 'Wallet',
    icon: 'wallet-outline',
    iconFamily: 'Ionicons'
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: 'person-outline',
    iconFamily: 'Ionicons'
  }
] as const;

export default function TabLayout() {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
  
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
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
                  />
                ),
                ...(tab.name === 'profile' && {
                  href: {
                    pathname: "/(tabs)/profile",
                    params: {}
                  }
                })
              }}
            />
          ))}
        </Tabs>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TabBarIcon(props: {
  name: string;
  color: string;
  iconFamily: 'Ionicons';
}) {
  const { name, color } = props;
  
  return <Ionicons name={name as any} size={24} color={color} style={{ marginBottom: -10 }} />;
}