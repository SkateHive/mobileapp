import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
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
}

export function PinInput({
  value,
  onChangeText,
  length = 6,
  onComplete,
  autoFocus = false,
  showDigits = false,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(digits);
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={styles.boxes}>
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
      />
    </Pressable>
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
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});
