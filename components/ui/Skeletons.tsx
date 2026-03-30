import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { theme } from '~/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;

export const SkeletonTile = React.memo(({ size, delay = 0 }: { size: number; delay?: number }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, opacity]);

  return <Animated.View style={{ width: size, height: size, backgroundColor: theme.colors.secondaryCard, opacity }} />;
});

export const GridSkeleton = ({ tileSize }: { tileSize: number }) => (
  <View style={[styles.gridContainer]}>
    {Array.from({ length: 12 }).map((_, i) => (
      <SkeletonTile key={i} size={tileSize} delay={(i % 3) * 150} />
    ))}
  </View>
);

export const ContentSkeleton = () => (
  <View style={styles.contentContainer}>
    <View style={styles.header}>
      <SkeletonTile size={40} />
      <View style={styles.headerText}>
        <SkeletonTile size={120} />
        <View style={{ height: 4 }} />
        <SkeletonTile size={60} />
      </View>
    </View>
    <View style={styles.body}>
        <SkeletonTile size={SCREEN_WIDTH - 32} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    justifyContent: 'flex-start',
  },
  contentContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  body: {
    height: 200,
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.md,
  },
});
