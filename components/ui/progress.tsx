import * as ProgressPrimitive from '@rn-primitives/progress';
import * as React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '~/lib/theme';

const Progress = React.forwardRef<
  ProgressPrimitive.RootRef,
  ProgressPrimitive.RootProps
>(({ value, style, ...props }, ref) => {
  return (
    <ProgressPrimitive.Root
      ref={ref}
      style={[styles.root, style]}
      {...props}
    >
      <Indicator value={value} />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

function Indicator({ value }: { value: number | undefined | null }) {
  const progress = useDerivedValue(() => value ?? 0);

  const indicator = useAnimatedStyle(() => {
    return {
      width: withSpring(
        `${interpolate(progress.value, [0, 100], [1, 100], Extrapolation.CLAMP)}%`,
        { overshootClamping: true }
      ),
    };
  });

  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.indicator, { transform: `translateX(-${100 - (value ?? 0)}%)` }]}
      >
        <ProgressPrimitive.Indicator style={styles.indicatorInner} />
      </View>
    );
  }

  return (
    <ProgressPrimitive.Indicator asChild>
      <Animated.View style={[indicator, styles.indicatorAnimated]} />
    </ProgressPrimitive.Indicator>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    height: 16,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: theme.colors.secondary,
  },
  indicator: {
    height: '100%',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  indicatorInner: {
    height: '100%',
    width: '100%',
  },
  indicatorAnimated: {
    height: '100%',
    backgroundColor: theme.colors.text,
  },
});
