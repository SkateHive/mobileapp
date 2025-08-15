import { Ionicons } from '@expo/vector-icons';
import { Tabs, Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '~/lib/theme';

const TAB_ITEMS = [
  {
    name: 'home',
    title: '',
    icon: 'enter-outline'
  },
  // {
  //   name: 'about',
  //   title: 'About',
  //   icon: 'bicycle-outline'
  // },
  // {
  //   name: 'style',
  //   title: 'Style',
  //   icon: 'image-outline' // Changed to differentiate from camera
  // },
  // {
  //   name: 'experience',
  //   title: 'Experience',
  //   icon: 'image-outline' // Changed to differentiate from camera
  // },
  // {
  //   name: 'welcome',
  //   title: 'Welcome',
  //   icon: 'person-outline'
  // }
] as const;

export default function TabOnboardLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: '#1a1a1a',
              },
              tabBarActiveTintColor: '#ffffff',
            }}
          >
            {TAB_ITEMS.map((tab) => (
              <Tabs.Screen
                key={tab.name}
                name={tab.name}
                options={{
                  title: tab.title,
                  tabBarIcon: ({ color }) => (
                    <TabBarIcon name={tab.icon} color={color} />
                  ),
                }}
              />
            ))}
          </Tabs>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} style={{ marginBottom: -3 }} {...props} />;
}

export function OnboardingLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="home" />
          <Stack.Screen name="about" />
          <Stack.Screen name="style" />
          <Stack.Screen name="experience" />
          <Stack.Screen name="welcome" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});