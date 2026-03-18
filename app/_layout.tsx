import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, FiraCode_400Regular, FiraCode_700Bold } from '@expo-google-fonts/fira-code';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '~/lib/auth-provider';
import { ToastProvider } from '~/lib/toast-provider';
import { ActivityWrapper } from '~/lib/ActivityWrapper';
import { ViewportTrackerProvider } from '~/lib/ViewportTracker';
import { NotificationProvider } from '~/lib/notifications-context';
import { ScrollLockProvider } from '~/lib/ScrollLockContext';
import { AppSettingsProvider } from '~/lib/AppSettingsContext';
import { theme } from '~/lib/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

// Initialize the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      onError: (error) => {
        console.error('Query error:', error);
      },
    },
  },
});

// Navigation Guard Component
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inConversation = segments.some(segment => segment === 'conversation');
    const inProtectedRoutes = inAuthGroup || inConversation;

    if (!isAuthenticated && inProtectedRoutes) {
      // User is not authenticated but trying to access protected routes
      // Redirect to login
      // console.log('User logged out, redirecting to login...');
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'FiraCode-Regular': FiraCode_400Regular,
    'FiraCode-Bold': FiraCode_700Bold,
  });

  useEffect(() => {
    const prepare = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (error) {
        console.warn('Splash prevent error:', error);
      }
    };
    prepare();
  }, []);

  useEffect(() => {
    const hide = async () => {
      if (fontsLoaded) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.warn('Splash hide error:', error);
        }
      }
    };
    hide();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <ScrollLockProvider>
            <NavigationGuard>
              <NotificationProvider>
                <ToastProvider>
                  <ViewportTrackerProvider>
                    <SafeAreaProvider>
                      <ActivityWrapper>
                        <View style={styles.container}>
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              animation: 'none',
                              contentStyle: { backgroundColor: theme.colors.background },
                            }}
                            initialRouteName="index"
                          >
                            <Stack.Screen name="index" />
                            <Stack.Screen name="login" />
                            <Stack.Screen name="about" />
                            <Stack.Screen name="conversation" />
                            <Stack.Screen
                              name="(tabs)"
                              options={{
                                animation: 'none',
                                gestureEnabled: false,
                              }}
                            />
                          </Stack>
                        </View>
                      </ActivityWrapper>
                    </SafeAreaProvider>
                  </ViewportTrackerProvider>
                </ToastProvider>
              </NotificationProvider>
            </NavigationGuard>
          </ScrollLockProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider >
  );
}