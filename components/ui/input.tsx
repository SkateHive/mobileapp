import * as React from 'react';
import { TextInput, type TextInputProps, StyleSheet } from 'react-native';
import { theme } from '~/lib/theme';

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, TextInputProps>(
  ({ style, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        style={[
          styles.input,
          props.editable === false && styles.disabled,
          style
        ]}
        placeholderTextColor={theme.colors.muted}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };

const styles = StyleSheet.create({
  input: {
    height: 48,
    width: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  disabled: {
    opacity: 0.5,
  },
});