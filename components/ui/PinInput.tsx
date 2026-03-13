import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { theme } from '~/lib/theme';

interface PinInputProps {
  value: string;
  onChangeText: (text: string) => void;
  length?: number;
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
}

export function PinInput({
  value,
  onChangeText,
  length = 6,
  onComplete,
  autoFocus = false,
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
              {isFilled && <View style={styles.dot} />}
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
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(50, 205, 50, 0.08)',
  },
  boxActive: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
