import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, FiraCode_400Regular, FiraCode_700Bold } from '@expo-google-fonts/fira-code';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '~/lib/auth-provider';
import { ToastProvider } from '~/lib/toast-provider';
import { ActivityWrapper } from '~/lib/ActivityWrapper';
import { NotificationProvider } from '~/lib/notifications-context';
import { theme } from '~/lib/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

// Keep splash screen visible while fonts are loading
SplashScreen.preventAutoHideAsync();

// Initialize the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 10, // 10 minutes — prevents unbounded cache growth on mobile
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
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inConversation = segments.some(segment => segment === 'conversation');
    const inProtectedRoutes = inAuthGroup || inConversation;

    if (!isAuthenticated && inProtectedRoutes) {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;
      router.replace('/');
    } else {
      isRedirectingRef.current = false;
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
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationGuard>
          <NotificationProvider>
            <ToastProvider>
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
                        <Stack.Screen 
                          name="index" 
                          options={{
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen 
                          name="login"
                          options={{
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen 
                          name="about"
                          options={{
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen 
                          name="conversation"
                          options={{
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen 
                          name="(tabs)"
                          options={{
                            animation: 'none',
                            contentStyle: { backgroundColor: theme.colors.background },
                            gestureEnabled: false,
                          }}
                        />
                      </Stack>
                    </View>
                  </ActivityWrapper>
                </SafeAreaProvider>
            </ToastProvider>
          </NotificationProvider>
        </NavigationGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}