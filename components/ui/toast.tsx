import React from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './text';
import { theme } from '../../lib/theme';
import { useAppSettings } from '~/lib/AppSettingsContext';
import { MatrixRain } from '~/components/ui/loading-effects/MatrixRain';

const { width } = Dimensions.get('window');

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onHide?: () => void;
}

export function Toast({ message, type = 'error', onHide }: ToastProps) {
  const { settings } = useAppSettings();
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
        {settings.theme === 'matrix' && (type === 'error' || type === 'success') && <MatrixRain containerHeight={100} intensity={0.3} />}
        <Text style={[
          styles.message,
          (type === 'error' || type === 'success') && styles.messageTextBold
        ]}>
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
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#FF3B30',
    overflow: 'hidden',
  },
  successBackground: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#22C55E', // theme.colors.green
    overflow: 'hidden',
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
  messageTextBold: {
    color: '#ffffff',
    fontFamily: theme.fonts.bold,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});