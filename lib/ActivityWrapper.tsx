import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { useActivityDetector } from './hooks/useActivityDetector';

interface ActivityWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that detects user interactions (touches, scrolls)
 * and resets the inactivity timer automatically
 */
export function ActivityWrapper({ children }: ActivityWrapperProps) {
  const { recordActivity } = useActivityDetector();
  const lastActivityRef = useRef<number>(Date.now());

  // Throttle activity recording to avoid excessive calls
  const throttledRecordActivity = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Only record activity if it's been more than 1 second since last activity
    if (timeSinceLastActivity > 1000) {
      lastActivityRef.current = now;
      recordActivity();
    }
  };

  // Create PanResponder to detect touch events
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        throttledRecordActivity();
        return false; // Don't capture the touch, let it pass through
      },
      onMoveShouldSetPanResponder: () => {
        throttledRecordActivity();
        return false; // Don't capture the touch, let it pass through
      },
      onPanResponderGrant: () => {
        throttledRecordActivity();
      },
      onPanResponderMove: () => {
        throttledRecordActivity();
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
