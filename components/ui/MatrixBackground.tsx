import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { Text } from './text';
import { theme } from '~/lib/theme';

const { width: SCREEN_WIDTH, height: TOAST_HEIGHT } = Dimensions.get('window');
const COLUMN_COUNT = 15;
const CHAR_SET = 'SKATEHIVE01'.split('');

interface MatrixColumnProps {
  index: number;
}

const MatrixColumn = ({ index }: MatrixColumnProps) => {
  const fallAnim = useRef(new Animated.Value(-100)).current;
  const chars = useMemo(() => {
    return Array.from({ length: 4 }).map(() => CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]);
  }, []);

  const startAnimation = () => {
    const duration = 2000 + Math.random() * 3000;
    const delay = Math.random() * 2000;

    Animated.loop(
      Animated.sequence([
        Animated.timing(fallAnim, {
          toValue: 150, // Enough to fall through the toast
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(fallAnim, {
          toValue: -100,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    startAnimation();
  }, []);

  const left = (SCREEN_WIDTH / COLUMN_COUNT) * index;

  return (
    <Animated.View
      style={[
        styles.column,
        {
          left,
          transform: [{ translateY: fallAnim }],
        },
      ]}
    >
      {chars.map((char, i) => (
        <Text
          key={i}
          style={[
            styles.char,
            {
              opacity: (i + 1) / chars.length,
            },
          ]}
        >
          {char}
        </Text>
      ))}
    </Animated.View>
  );
};

export const MatrixBackground = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
        <MatrixColumn key={i} index={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  column: {
    position: 'absolute',
    top: 0,
    width: 20,
    alignItems: 'center',
  },
  char: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    lineHeight: 14,
    textShadowColor: 'rgba(50, 205, 50, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
