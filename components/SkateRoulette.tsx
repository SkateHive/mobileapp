import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '~/components/ui/text';
import { SKATE_DICE, faceLabel, type SkateDie } from '~/lib/skate-dice-data';
import { t } from '~/lib/i18n';
import { theme } from '~/lib/theme';

interface Props {
  onRoll: (faces: string[]) => void;
}

export interface SkateRouletteHandle {
  roll: () => void;
}

const ITEM_H = 64;
const ROWS = 3; // visible rows (center is the result)
const SPINS = 16; // full loops before landing
const REPEAT = SPINS + 6;
const BASE_DURATION = 1500;
const STAGGER = 380; // each column lands later, left → right

// One vertical reel that spins and lands its `targetIndex` face in the center.
function Reel({
  die,
  targetIndex,
  spinId,
  duration,
}: {
  die: SkateDie;
  targetIndex: number;
  spinId: number;
  duration: number;
}) {
  const o = useSharedValue(0);
  const data = useMemo(
    () => Array.from({ length: REPEAT * 6 }, (_, i) => die.faces[i % 6]),
    [die.faces],
  );

  useEffect(() => {
    if (spinId === 0) return;
    o.value = 0; // restart from top (brief, hidden by the fast spin)
    const finalRow = SPINS * 6 + targetIndex; // center this row
    o.value = withTiming((finalRow - 1) * ITEM_H, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [spinId]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -o.value }] }));

  return (
    <View style={styles.reel}>
      <Text style={styles.reelHeader}>{t(die.headerKey)}</Text>
      <View style={styles.window}>
        <Animated.View style={style}>
          {data.map((face, i) => (
            <View key={i} style={styles.cell}>
              <Text
                style={[styles.cellText, { color: die.color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {faceLabel(face)}
              </Text>
            </View>
          ))}
        </Animated.View>
        {/* top & bottom fade */}
        <View style={[styles.fade, styles.fadeTop]} pointerEvents="none" />
        <View style={[styles.fade, styles.fadeBottom]} pointerEvents="none" />
        {/* center result band */}
        <View style={styles.centerBand} pointerEvents="none" />
      </View>
    </View>
  );
}

const SkateRoulette = forwardRef<SkateRouletteHandle, Props>(({ onRoll }, ref) => {
  const [spinId, setSpinId] = useState(0);
  const [targets, setTargets] = useState<number[]>([0, 1, 0, 0]);
  const spinningRef = useRef(false);
  const lastRollRef = useRef(0);

  const roll = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    lastRollRef.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const picks = SKATE_DICE.map(() => Math.floor(Math.random() * 6));
    setTargets(picks);
    setSpinId((id) => id + 1);

    const total = BASE_DURATION + (SKATE_DICE.length - 1) * STAGGER;
    setTimeout(() => {
      spinningRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRoll(SKATE_DICE.map((d, i) => d.faces[picks[i]]));
    }, total + 80);
  }, [onRoll]);

  useImperativeHandle(ref, () => ({ roll }), [roll]);

  // Shake-to-roll (accelerometer); degrades silently where unavailable.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let mounted = true;
    (async () => {
      try {
        const { Accelerometer } = require('expo-sensors');
        if (!(await Accelerometer.isAvailableAsync()) || !mounted) return;
        Accelerometer.setUpdateInterval(120);
        sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
          if (Math.sqrt(x * x + y * y + z * z) > 1.8 && Date.now() - lastRollRef.current > 1500) {
            roll();
          }
        });
      } catch {
        /* no sensor — tap still rolls */
      }
    })();
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [roll]);

  return (
    <Pressable onPress={roll} style={styles.machine}>
      <View style={styles.reels}>
        {SKATE_DICE.map((die, i) => (
          <Reel
            key={die.key}
            die={die}
            targetIndex={targets[i]}
            spinId={spinId}
            duration={BASE_DURATION + i * STAGGER}
          />
        ))}
      </View>
    </Pressable>
  );
});

SkateRoulette.displayName = 'SkateRoulette';
export default SkateRoulette;

const styles = StyleSheet.create({
  machine: {
    backgroundColor: '#0F0E11',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1F1E24',
    padding: 14,
  },
  reels: { flexDirection: 'row', gap: 8 },
  reel: { flex: 1, alignItems: 'center' },
  reelHeader: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    marginBottom: 8,
  },
  window: {
    height: ROWS * ITEM_H,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000',
  },
  cell: { height: ITEM_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  cellText: { fontSize: 17, fontFamily: theme.fonts.bold, textAlign: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, height: ITEM_H, zIndex: 2 },
  fadeTop: { top: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  fadeBottom: { bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  centerBand: {
    position: 'absolute',
    top: ITEM_H,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(50,205,50,0.06)',
    zIndex: 1,
  },
});
