import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '~/components/ui/text';
import { theme } from '~/lib/theme';

const PRESETS = [5, 10, 25, 50, 75, 100];

interface VotePresetButtonsProps {
  onSelect: (weight: number) => void;
  disabled?: boolean;
}

export function VotePresetButtons({ onSelect, disabled = false }: VotePresetButtonsProps) {
  return (
    <View style={styles.container}>
      {PRESETS.map((weight) => (
        <Pressable
          key={weight}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
          onPress={() => onSelect(weight)}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>{weight}%</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(50, 205, 50, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(50, 205, 50, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(50, 205, 50, 0.3)',
    borderColor: theme.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
});
