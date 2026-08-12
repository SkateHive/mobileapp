import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '~/lib/theme';
import { Text } from './text';

const SPITFIRE = require('../../assets/images/spitfire.png');

const TRACK_HEIGHT = 16;
const THUMB_SIZE = 34;

interface VotingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isVoting?: boolean;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
}

/**
 * The vote-weight bar, matching the web slider (#55): one gradient track with
 * the Spitfire head as the thumb, a VOTE button carrying the live percentage,
 * and an X to back out.
 *
 * Confirm and cancel live in here rather than in the caller because the button
 * label is the slider's value — splitting them meant passing the number back
 * out just to render it.
 */
export function VotingSlider({
  value,
  onValueChange,
  onConfirm,
  onCancel,
  isVoting = false,
  minimumValue = 1,
  maximumValue = 100,
  step = 1,
}: VotingSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackX = useRef(0);
  const trackRef = useRef<View>(null);

  const updateFromPageX = useCallback(
    (pageX: number) => {
      if (!trackWidth) return;
      const ratio = Math.max(0, Math.min(1, (pageX - trackX.current) / trackWidth));
      const raw = minimumValue + ratio * (maximumValue - minimumValue);
      const stepped = Math.round(raw / step) * step;
      onValueChange(Math.max(minimumValue, Math.min(maximumValue, stepped)));
    },
    [trackWidth, minimumValue, maximumValue, step, onValueChange]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) =>
        updateRef.current(e.nativeEvent.pageX),
      onPanResponderMove: (e: GestureResponderEvent) =>
        updateRef.current(e.nativeEvent.pageX),
    })
  ).current;

  // The responder is built once, so it reads the current handler through a ref
  // instead of capturing the first one. Assigned in an effect, not during
  // render: React can discard a render, and a ref written in one would leak a
  // callback from work that never committed.
  const updateRef = useRef(updateFromPageX);
  useLayoutEffect(() => {
    updateRef.current = updateFromPageX;
  }, [updateFromPageX]);

  const ratio = (value - minimumValue) / (maximumValue - minimumValue);
  // The head stays inside the track, and the dimming starts where it ends —
  // so at 100% the head lands flush against the right edge with nothing left
  // to dim, and at 1% it covers the sliver of bar behind it.
  const thumbLeft = ratio * Math.max(0, trackWidth - THUMB_SIZE);

  return (
    <View style={styles.row}>
      <View
        ref={trackRef}
        style={styles.trackArea}
        onLayout={() => {
          trackRef.current?.measure((_x, _y, width, _h, pageX) => {
            trackX.current = pageX;
            setTrackWidth(width);
          });
        }}
        {...pan.panHandlers}
      >
        <LinearGradient
          colors={theme.gradients.vote}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.track}
        />
        {/* Everything past the thumb is dimmed, so the bar still shows how far
            along you are — the gradient alone carries no position. */}
        <View
          // `left` stays inline: it changes on every drag frame, so hoisting it
          // would just build the same object somewhere else.
          style={[styles.unfilled, { left: thumbLeft + THUMB_SIZE }]}
          pointerEvents="none"
        />
        <Image
          source={SPITFIRE}
          style={[styles.thumb, { left: thumbLeft }]}
          contentFit="contain"
          pointerEvents="none"
        />
      </View>

      <Pressable
        style={[styles.voteButton, isVoting && styles.disabled]}
        onPress={onConfirm}
        disabled={isVoting}
        // 30px tall by design — a taller button would drag the whole bar with
        // it. hitSlop gets the touch target to 44 without touching the layout.
        hitSlop={{ top: 7, bottom: 7 }}
        accessibilityRole="button"
        accessibilityLabel={`Vote ${value} percent`}
        accessibilityState={{ disabled: isVoting }}
      >
        {isVoting ? (
          <ActivityIndicator size="small" color={theme.colors.black} />
        ) : (
          <Text style={styles.voteText}>VOTE {value}%</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={onCancel}
        disabled={isVoting}
        hitSlop={{ top: 7, bottom: 7, right: 7 }}
        accessibilityRole="button"
        accessibilityLabel="Cancel vote"
      >
        <Ionicons name="close" size={18} color={theme.colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  trackArea: {
    flex: 1,
    height: 44, // the bar is thin; the touch target is not
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  unfilled: {
    position: 'absolute',
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: theme.colors.scrim,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  voteButton: {
    backgroundColor: theme.colors.voteButton,
    paddingHorizontal: theme.spacing.sm,
    // Fixed: the label runs from "VOTE 1%" to "VOTE 100%", and letting the
    // button follow it resized the track under your finger while dragging.
    minWidth: 92,
    height: 30,
    borderRadius: theme.borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  voteText: {
    color: theme.colors.black,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xs,
  },
  cancelButton: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
