import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '~/components/ui/text';
import SkateRoulette, { type SkateRouletteHandle } from '~/components/SkateRoulette';
import MatrixRain from '~/components/MatrixRain';
import { trickFromFaces } from '~/lib/skate-dice-data';
import {
  randomSentenceTemplate,
  randomPrompt,
  splitTemplate,
} from '~/lib/skate-sentences';
import { theme } from '~/lib/theme';
import { t } from '~/lib/i18n';

const TYPE_MS = 26; // per-character typing speed

export default function PracticeDiceScreen() {
  const [trick, setTrick] = useState<string | null>(null);
  const [template, setTemplate] = useState<string>(() => randomPrompt());
  const [typed, setTyped] = useState(0);
  const [ready, setReady] = useState(false); // intro finished → typing may run
  const rouletteRef = useRef<SkateRouletteHandle>(null);

  // Intro animation: Fred slides up, then the balloon pops in.
  const fredY = useSharedValue(420);
  const balloon = useSharedValue(0);

  useEffect(() => {
    fredY.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) });
    balloon.value = withDelay(650, withTiming(1, { duration: 280 }));
    const timer = setTimeout(() => setReady(true), 950);
    return () => clearTimeout(timer);
  }, []);

  const { before, after } = splitTemplate(template);
  const trickStr = trick ?? '';
  const total = before.length + trickStr.length + after.length;

  // Typing effect — runs once the intro is ready and re-runs on each new line.
  useEffect(() => {
    if (!ready) return;
    setTyped(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= total) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [ready, template, trick, total]);

  const handleRoll = (faces: string[]) => {
    setTrick(trickFromFaces(faces));
    setTemplate(randomSentenceTemplate());
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/videos');
  };

  const fredStyle = useAnimatedStyle(() => ({ transform: [{ translateY: fredY.value }] }));
  const balloonStyle = useAnimatedStyle(() => ({
    opacity: balloon.value,
    transform: [{ translateY: (1 - balloon.value) * 14 }, { scale: 0.96 + balloon.value * 0.04 }],
  }));

  // Reveal typed slices, keeping the trick segment highlighted.
  const shownBefore = before.slice(0, Math.min(typed, before.length));
  const shownTrick = trickStr.slice(0, Math.max(0, Math.min(typed - before.length, trickStr.length)));
  const shownAfter = after.slice(0, Math.max(0, typed - before.length - trickStr.length));
  const typing = typed < total;

  return (
    <SafeAreaView style={styles.viewport} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('dice.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Top: reels + PLAY */}
      <View style={styles.top}>
        <SkateRoulette ref={rouletteRef} onRoll={handleRoll} />

        <Pressable style={styles.playBtn} onPress={() => rouletteRef.current?.roll()}>
          <Ionicons name="dice" size={26} color={theme.colors.black} />
          <Text style={styles.playText}>{t('dice.play')}</Text>
        </Pressable>
      </View>

      {/* Bottom: matrix backdrop, coach slides up, speech balloon types */}
      <View style={styles.bottom}>
        <MatrixRain />

        <Animated.View style={[styles.characterWrap, fredStyle]}>
          <Image
            source={require('~/assets/images/skatehive-coach.png')}
            style={styles.character}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.balloonWrap, balloonStyle]}>
          <View style={styles.balloon}>
            <Text style={styles.balloonText}>
              {shownBefore}
              {shownTrick ? <Text style={styles.trickHL}>{shownTrick}</Text> : null}
              {shownAfter}
              {typing ? <Text style={styles.cursor}>▋</Text> : null}
            </Text>
            <View style={styles.tail} />
            <View style={styles.tailInner} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: '#070709' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backBtn: { width: 44, alignItems: 'flex-start' },
  headerTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 2,
    color: theme.colors.primary,
  },
  top: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, zIndex: 3 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 22,
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  playText: {
    color: theme.colors.black,
    fontFamily: theme.fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 3,
  },
  bottom: { flex: 1, position: 'relative', overflow: 'hidden' },
  characterWrap: {
    position: 'absolute',
    bottom: -64, // translate down so his arm meets the screen's bottom edge
    left: 0,
    right: 0,
    width: '100%',
    aspectRatio: 418 / 358,
  },
  character: { width: '100%', height: '100%' },
  balloonWrap: {
    position: 'absolute',
    top: 6,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  balloon: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 3,
    borderColor: '#0c0c0c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  balloonText: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: theme.fonts.regular,
    color: '#15151a',
  },
  trickHL: {
    fontFamily: theme.fonts.bold,
    color: '#0a8f2c',
  },
  cursor: { color: '#0a8f2c', fontFamily: theme.fonts.bold },
  tail: {
    position: 'absolute',
    bottom: -16,
    right: 70,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0c0c0c',
  },
  tailInner: {
    position: 'absolute',
    bottom: -10,
    right: 73,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
});
