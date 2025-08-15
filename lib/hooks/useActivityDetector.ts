import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../auth-provider';

/**
 * Hook that detects user activity and resets the inactivity timer
 * This should be used at the app level to detect global activity
 */
export function useActivityDetector() {
  const { resetInactivityTimer, isAuthenticated } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Handle app state changes (background/foreground)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - reset timer
        resetInactivityTimer();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, resetInactivityTimer]);

  // Return a function that can be called manually to reset activity
  const recordActivity = () => {
    if (isAuthenticated) {
      resetInactivityTimer();
    }
  };

  return { recordActivity };
}
