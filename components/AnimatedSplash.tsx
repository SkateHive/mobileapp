import React from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { theme } from "~/lib/theme";

// The launch animation: the round logo assembles itself (circle, SKATE,
// wheel, HIVE), holds a beat, then zooms open onto the app. The native
// splash before it is plain black (see app.json), so this starts from an
// empty screen. The three layers are slices of icon-android.png on the same
// transparent canvas, so stacking them rebuilds the logo exactly.
const SKATE = require("~/assets/images/splash/skate.png");
const WHEEL = require("~/assets/images/splash/wheel.png");
const HIVE = require("~/assets/images/splash/hive.png");

const LOGO_BG = "#090409"; // the logo circle's own colour
const OUT_START = 1050; // ms: when the zoom-out begins
const TOTAL = 1400; // ms: when the overlay is gone

const easeOut = Easing.out(Easing.cubic);

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(width, height) * 0.6);
  const reduceMotion = useReducedMotion();

  const circle = useSharedValue(0);
  const skate = useSharedValue(0);
  const wheel = useSharedValue(0);
  const hive = useSharedValue(0);
  const out = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      circle.value = skate.value = wheel.value = hive.value = 1;
      out.value = withDelay(400, withTiming(1, { duration: 200 }));
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    circle.value = withSpring(1, { damping: 14, stiffness: 160 });
    skate.value = withDelay(150, withTiming(1, { duration: 320, easing: easeOut }));
    wheel.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 140 }));
    hive.value = withDelay(450, withTiming(1, { duration: 320, easing: easeOut }));
    out.value = withDelay(OUT_START, withTiming(1, { duration: TOTAL - OUT_START, easing: Easing.in(Easing.cubic) }));
    const t = setTimeout(onDone, TOTAL);
    return () => clearTimeout(t);
    // Runs once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + out.value * 0.35 }] }));
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circle.value }] }));
  const skateStyle = useAnimatedStyle(() => ({
    opacity: skate.value,
    transform: [{ translateY: (1 - skate.value) * -size * 0.18 }],
  }));
  const wheelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, wheel.value * 1.5),
    transform: [{ translateX: (1 - wheel.value) * -size * 0.5 }, { scale: 0.85 + 0.15 * wheel.value }],
  }));
  const hiveStyle = useAnimatedStyle(() => ({
    opacity: hive.value,
    transform: [{ translateY: (1 - hive.value) * size * 0.18 }],
  }));

  const box = { width: size, height: size };
  return (
    <Animated.View style={[styles.overlay, overlayStyle]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[box, logoStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.circle, { borderRadius: size / 2 }, circleStyle]} />
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: size / 2 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, wheelStyle]}>
            <Image source={WHEEL} style={box} fadeDuration={0} />
          </Animated.View>
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, skateStyle]}>
          <Image source={SKATE} style={box} fadeDuration={0} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, hiveStyle]}>
          <Image source={HIVE} style={box} fadeDuration={0} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    elevation: 1000,
  },
  circle: { backgroundColor: LOGO_BG },
  // The wheel rolls in from the left; keep it inside the circle while it does.
  clip: { overflow: "hidden" },
});
