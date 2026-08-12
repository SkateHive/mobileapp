import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import { theme } from '~/lib/theme';

interface PinInputProps {
  value: string;
  onChangeText: (text: string) => void;
  length?: number;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
  /**
   * Show the digits instead of dots. On for an emailed code, which is not a
   * secret and which people re-read while typing; off for a PIN.
   */
  showDigits?: boolean;
  /** Paints the boxes red — the code was rejected. */
  hasError?: boolean;
}

export function PinInput({
  value,
  onChangeText,
  length = 6,
  onComplete,
  autoFocus = false,
  showDigits = false,
  hasError = false,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);

  // Fire once per completed value. onComplete's identity changes on every
  // render of the parent, so without this guard the effect re-ran constantly
  // while the boxes were full — verifying the same code over and over, and the
  // repeat attempts failed after the first one consumed it.
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (value.length !== length) {
      firedFor.current = null;
      return;
    }
    if (firedFor.current === value) return;
    firedFor.current = value;
    onComplete?.(value);
  }, [value, length, onComplete]);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(digits);
  };

  return (
    // A View, not a Pressable: the transparent input on top already takes taps,
    // and a Pressable wrapper swallowed the long-press that opens Paste.
    <View style={styles.container}>
      <View style={styles.boxes} pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                isFilled && styles.boxFilled,
                isActive && styles.boxActive,
                hasError && styles.boxError,
              ]}
            >
              {isFilled &&
                (showDigits ? (
                  <Text style={styles.digit}>{value[i]}</Text>
                ) : (
                  <View style={styles.dot} />
                ))}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
        // Lets iOS offer the code above the keyboard, and keeps the paste menu
        // available on long-press.
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        contextMenuHidden={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  boxes: {
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    width: 42,
    height: 52,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    borderColor: theme.auth.borderIdle,
    backgroundColor: theme.auth.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFilled: {
    borderColor: theme.auth.neon,
  },
  boxActive: {
    borderColor: theme.auth.textTertiary,
  },
  boxError: {
    borderColor: theme.colors.danger,
  },
  digit: {
    color: theme.auth.neon,
    fontFamily: theme.fonts.bold,
    fontSize: 20,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  // Invisible, but it covers the boxes rather than being 0×0 offscreen: with
  // nothing to long-press there was no way to paste a code copied out of an
  // email, and one-time codes are exactly what people paste.
  // Invisible but real: it sits on top of the boxes so a tap focuses it and a
  // long-press offers Paste — one-time codes are exactly what people paste.
  // Not fully transparent, because a zero-opacity input is unreliable to hit.
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
    fontSize: 20,
    textAlign: 'center',
  },
});
