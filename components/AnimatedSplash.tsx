import React from "react";
import { Image, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { theme } from "~/lib/theme";

/*
 * Launch animation (Android). The round logo boots like a CRT and builds
 * itself in the app's pixel style:
 *   1. a green scanline opens into the dark circle,
 *   2. SKATE is typed letter by letter behind a block cursor,
 *   3. the wheel kicks in from the left and its speed lines stretch out,
 *   4. HIVE is typed,
 *   5. an RGB glitch, then the camera dives through the wheel's hub
 *      into the app.
 *
 * The app tree mounts only after the logo is built (onAppMount), so mounting
 * it can't stall the animation, and the dive waits for `appReady`. The native
 * splash before this is plain black; we hide it on our first frame.
 *
 * Layers are slices of icon-android.png on one 512 px canvas, so they stack
 * back into the exact logo. Coordinates below are in that 512 space.
 */
const SKATE = require("~/assets/images/splash/skate.png");
const WHEEL = require("~/assets/images/splash/wheel-core.png");
const LINES = require("~/assets/images/splash/wheel-lines.png");
const HIVE = require("~/assets/images/splash/hive.png");

const CANVAS = 512;
const SKATE_LETTERS = { start: 91, ends: [140, 213, 283, 363, 431], top: 87, height: 70 };
const HIVE_LETTERS = { start: 104, ends: [171, 231, 336, 431], top: 366, height: 73 };
const LINES_START_X = 285; // speed lines grow rightwards from here
const HUB = { x: 240, y: 255 }; // centre of the wheel's hub: the dive target

const LOGO_BG = "#090409"; // the logo circle's own colour
const GREEN = theme.colors.primary;
const GLITCH_A = "#ff2a6d";
const GLITCH_B = "#05d9e8";

const T = {
  scanline: 220,
  openAt: 200,
  open: 240,
  skateAt: 420,
  skate: 360,
  wheelAt: 640,
  linesAt: 740,
  lines: 280,
  hiveAt: 840,
  hive: 300,
  appMountAt: 900,
  glitchAt: 1180,
  holdUntil: 1450,
  dive: 520,
};

interface Props {
  /** First frame is on screen: hide the native splash now. */
  onReady: () => void;
  /** The logo is built: safe to mount the app underneath. */
  onAppMount: () => void;
  /** The app has rendered under the overlay. */
  appReady: boolean;
  /** The dive is over: remove the overlay. */
  onDone: () => void;
}

export function AnimatedSplash({ onReady, onAppMount, appReady, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(width, height) * 0.62);
  const u = size / CANVAS; // 512-space units to screen points
  const reduceMotion = useReducedMotion();

  const scan = useSharedValue(0);
  const open = useSharedValue(0);
  const skate = useSharedValue(0);
  const wheel = useSharedValue(0);
  const lines = useSharedValue(0);
  const hive = useSharedValue(0);
  const glitch = useSharedValue(0);
  const dive = useSharedValue(0);

  const [started, setStarted] = React.useState(false);
  const [built, setBuilt] = React.useState(false);

  const onLayout = React.useCallback(
    (_e: LayoutChangeEvent) => {
      if (started) return;
      setStarted(true);
      onReady();
    },
    [started, onReady],
  );

  // Build the logo once the overlay is on screen.
  React.useEffect(() => {
    if (!started) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduceMotion) {
      scan.value = open.value = skate.value = wheel.value = lines.value = hive.value = 1;
      onAppMount();
      timers.push(setTimeout(() => setBuilt(true), 300));
    } else {
      const out = Easing.out(Easing.cubic);
      scan.value = withTiming(1, { duration: T.scanline, easing: out });
      open.value = withDelay(T.openAt, withTiming(1, { duration: T.open, easing: Easing.out(Easing.back(1.4)) }));
      skate.value = withDelay(T.skateAt, withTiming(1, { duration: T.skate, easing: Easing.linear }));
      wheel.value = withDelay(T.wheelAt, withSpring(1, { damping: 11, stiffness: 150 }));
      lines.value = withDelay(T.linesAt, withTiming(1, { duration: T.lines, easing: out }));
      hive.value = withDelay(T.hiveAt, withTiming(1, { duration: T.hive, easing: Easing.linear }));
      glitch.value = withDelay(
        T.glitchAt,
        withSequence(
          withTiming(1, { duration: 50 }),
          withTiming(0.2, { duration: 50 }),
          withTiming(1, { duration: 40 }),
          withTiming(0, { duration: 90 }),
        ),
      );
      timers.push(setTimeout(onAppMount, T.appMountAt));
      timers.push(setTimeout(() => setBuilt(true), T.holdUntil));
    }
    return () => timers.forEach(clearTimeout);
    // Runs once, when the overlay first lays out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Dive into the app once the logo is built and the app has rendered.
  React.useEffect(() => {
    if (!built || !appReady) return;
    const duration = reduceMotion ? 250 : T.dive;
    dive.value = withTiming(1, { duration, easing: Easing.in(Easing.cubic) });
    const t = setTimeout(onDone, duration + 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, appReady]);

  // ── styles ────────────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dive.value, [0, 0.55, 1], [1, 1, 0]),
  }));

  // Zoom around the hub: keep that point fixed while scaling up.
  const hubDx = (HUB.x - CANVAS / 2) * u;
  const hubDy = (HUB.y - CANVAS / 2) * u;
  const logoStyle = useAnimatedStyle(() => {
    const s = reduceMotion ? 1 : 1 + dive.value * dive.value * 15;
    return {
      transform: [{ translateX: -hubDx * (s - 1) }, { translateY: -hubDy * (s - 1) }, { scale: s }],
    };
  });

  // CRT boot: a thin green line widens, then opens vertically into the circle.
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(open.value, [0, 0.6, 1], [GREEN, GREEN, LOGO_BG]),
    borderRadius: interpolate(open.value, [0, 1], [2, size / 2]),
    transform: [{ scaleX: scan.value }, { scaleY: interpolate(open.value, [0, 1], [0.012, 1]) }],
  }));

  const typed = (v: number, letters: { start: number; ends: number[] }) => {
    "worklet";
    const n = Math.min(letters.ends.length, Math.ceil(v * letters.ends.length));
    return n === 0 ? 0 : letters.ends[n - 1] + 6;
  };
  const skateClip = useAnimatedStyle(() => ({ width: typed(skate.value, SKATE_LETTERS) * u }));
  const hiveClip = useAnimatedStyle(() => ({ width: typed(hive.value, HIVE_LETTERS) * u }));

  const cursorStyle = (v: { value: number }, letters: typeof SKATE_LETTERS) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const x = typed(v.value, letters) || letters.start;
      return {
        opacity: v.value > 0 && v.value < 1 ? 1 : 0,
        transform: [{ translateX: (x + 4) * u }],
      };
    });
  const skateCursor = cursorStyle(skate, SKATE_LETTERS);
  const hiveCursor = cursorStyle(hive, HIVE_LETTERS);

  const wheelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(wheel.value, [0, 0.15], [0, 1], "clamp"),
    transform: [
      { translateX: (1 - wheel.value) * -size * 0.6 },
      { rotate: `${(1 - wheel.value) * -14}deg` },
    ],
  }));
  const linesStyle = useAnimatedStyle(() => ({
    opacity: lines.value > 0 ? 1 : 0,
    transform: [{ scaleX: lines.value }],
  }));

  const glitchA = useAnimatedStyle(() => ({
    opacity: glitch.value * 0.75,
    transform: [{ translateX: glitch.value * size * 0.03 }],
  }));
  const glitchB = useAnimatedStyle(() => ({
    opacity: glitch.value * 0.75,
    transform: [{ translateX: glitch.value * -size * 0.03 }, { translateY: glitch.value * size * 0.008 }],
  }));

  const box = { width: size, height: size };
  const linesOrigin = { transformOrigin: `${(LINES_START_X / CANVAS) * 100}% 50%` };
  const layer = (src: number, tint?: string) => (
    <Image source={src} style={[box, tint ? { tintColor: tint } : null]} fadeDuration={0} />
  );
  const ghost = (tint: string) => (
    <>
      <View style={StyleSheet.absoluteFill}>{layer(SKATE, tint)}</View>
      <View style={StyleSheet.absoluteFill}>{layer(WHEEL, tint)}</View>
      <View style={StyleSheet.absoluteFill}>{layer(LINES, tint)}</View>
      <View style={StyleSheet.absoluteFill}>{layer(HIVE, tint)}</View>
    </>
  );

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      onLayout={onLayout}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[box, logoStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, circleStyle]} />

        <Animated.View style={[StyleSheet.absoluteFill, glitchA]}>{ghost(GLITCH_A)}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, glitchB]}>{ghost(GLITCH_B)}</Animated.View>

        <Animated.View style={[styles.clip, { height: size }, skateClip]}>{layer(SKATE)}</Animated.View>
        <Animated.View
          style={[styles.cursor, { top: SKATE_LETTERS.top * u, height: SKATE_LETTERS.height * u, width: 14 * u }, skateCursor]}
        />

        <View style={[StyleSheet.absoluteFill, styles.round, { borderRadius: size / 2 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, linesOrigin, linesStyle]}>{layer(LINES)}</Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, wheelStyle]}>{layer(WHEEL)}</Animated.View>
        </View>

        <Animated.View style={[styles.clip, { height: size }, hiveClip]}>{layer(HIVE)}</Animated.View>
        <Animated.View
          style={[styles.cursor, { top: HIVE_LETTERS.top * u, height: HIVE_LETTERS.height * u, width: 14 * u }, hiveCursor]}
        />
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
  // Typing reveal: a left-anchored window that widens one letter at a time.
  clip: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  cursor: { position: "absolute", left: 0, backgroundColor: GREEN },
  // The wheel kicks in from outside the circle; keep it inside while it does.
  round: { overflow: "hidden" },
});
