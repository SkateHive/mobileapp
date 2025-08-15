import React from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './text';
import { theme } from '../../lib/theme';

const { width } = Dimensions.get('window');

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onHide?: () => void;
}

export function Toast({ message, type = 'error', onHide }: ToastProps) {
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      // Slide in
      Animated.spring(translateY, {
        toValue: 50,
        useNativeDriver: true,
        tension: 20,
        friction: 5
      }),
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();

    // Auto hide after delay
    const timer = setTimeout(() => {
      hideToast();
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => onHide?.());
  };

  const getBackgroundStyle = () => {
    switch (type) {
      case 'error':
        return styles.errorBackground;
      case 'success':
        return styles.successBackground;
      case 'info':
        return styles.infoBackground;
      default:
        return styles.errorBackground;
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={hideToast}>
      <Animated.View
        style={[
          styles.container,
          getBackgroundStyle(),
          {
            transform: [{ translateY }],
            opacity,
            width: width - 32,
          }
        ]}
      >
        <Text style={styles.message}>
          {message}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 50,
    top: 0,
    left: 0,
    right: 0,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  errorBackground: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // red-500/90
  },
  successBackground: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)', // green-500/90
  },
  infoBackground: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)', // blue-500/90
  },
  message: {
    color: '#ffffff',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    fontSize: 16,
  },
});