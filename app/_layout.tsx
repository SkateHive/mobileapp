import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, FiraCode_400Regular, FiraCode_700Bold } from '@expo-google-fonts/fira-code';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '~/lib/auth-provider';
import { ToastProvider } from '~/lib/toast-provider';
import { ActivityWrapper } from '~/lib/ActivityWrapper';
import { NotificationProvider } from '~/lib/notifications-context';
import { SoftPostProvider } from '~/lib/userbase/soft-post-context';
import { useSpotWidgetSync } from '~/lib/hooks/useSpotWidgetSync';
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
  const { isAuthenticated, isLoading, enterSpectatorMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isRedirectingRef = useRef(false);
  const enteringSpectatorRef = useRef(false);

  // Refresh the iOS "Nearby Spots" widget on app open / foreground (no-op elsewhere).
  useSpotWidgetSync();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inConversation = segments.some(segment => segment === 'conversation');
    // The skate-spot map is public data — when a deep link (e.g. the iOS widget)
    // opens it logged-out, drop into read-only spectator mode instead of bouncing
    // through the login wall. The user can log in later to interact.
    const isPublicMap = inAuthGroup && segments[1] === 'map';
    const inProtectedRoutes = (inAuthGroup && !isPublicMap) || inConversation;

    if (!isAuthenticated && isPublicMap) {
      if (enteringSpectatorRef.current) return;
      enteringSpectatorRef.current = true;
      enterSpectatorMode()
        .catch(() => {})
        .finally(() => {
          enteringSpectatorRef.current = false;
        });
      return;
    }

    if (!isAuthenticated && inProtectedRoutes) {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;
      router.replace('/');
    } else {
      isRedirectingRef.current = false;
    }
  }, [isAuthenticated, isLoading, segments, router, enterSpectatorMode]);

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
    <GestureHandlerRootView style={styles.container}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationGuard>
          <NotificationProvider>
            <ToastProvider>
              <SoftPostProvider>
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
                          name="spot/[author]/[permlink]"
                          options={{
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen
                          name="spot-create"
                          options={{
                            presentation: 'modal',
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        {/* Pushed, not presented as a modal: a stack screen
                            gets iOS back-swipe for free, which is the whole
                            reason the viewer moved off Modal (#35). The slide
                            has to be set here — the stack defaults to no
                            animation, and without one there's no gesture. */}
                        <Stack.Screen
                          name="post-viewer"
                          options={{
                            animation: 'slide_from_right',
                            gestureEnabled: true,
                            // The edge-only recogniser never fired: the pager
                            // fills the screen and takes the touch first. The
                            // full-screen one is a pan and competes properly —
                            // held to the left 60px by gestureResponseDistance,
                            // which only applies in this mode, so a horizontal
                            // swipe anywhere else still belongs to the image
                            // carousel.
                            fullScreenGestureEnabled: true,
                            gestureResponseDistance: { start: 60 },
                            contentStyle: { backgroundColor: theme.colors.black },
                          }}
                        />
                        <Stack.Screen
                          name="skate-dice/index"
                          options={{
                            contentStyle: { backgroundColor: '#070709' },
                          }}
                        />
                        <Stack.Screen
                          name="hive-login"
                          options={{
                            animation: 'slide_from_right',
                            gestureEnabled: true,
                            contentStyle: { backgroundColor: theme.colors.background },
                          }}
                        />
                        <Stack.Screen
                          name="email-login"
                          options={{
                            presentation: 'modal',
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
              </SoftPostProvider>
            </ToastProvider>
          </NotificationProvider>
        </NavigationGuard>
      </AuthProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}