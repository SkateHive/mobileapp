import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { theme } from '~/lib/theme';

const { width, height } = Dimensions.get('window');

export function SkeletonBackground() {
  const opacity = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 2000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {/* Some abstract pulsing blocks to simulate "skeleton" feel */}
      <Animated.View style={[styles.block, { top: '10%', left: '5%', width: '40%', height: 20, opacity }]} />
      <Animated.View style={[styles.block, { top: '15%', left: '5%', width: '80%', height: 150, opacity }]} />
      
      <Animated.View style={[styles.block, { top: '40%', left: '10%', width: '70%', height: 20, opacity }]} />
      <Animated.View style={[styles.block, { top: '45%', left: '10%', width: '30%', height: 20, opacity }]} />
      
      <Animated.View style={[styles.block, { bottom: '20%', left: '5%', width: '90%', height: 100, opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  block: {
    position: 'absolute',
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.md,
  },
});
