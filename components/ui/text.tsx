import * as Slot from '@rn-primitives/slot';
import type { SlottableTextProps, TextRef } from '@rn-primitives/types';
import * as React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { theme } from '~/lib/theme';

const TextClassContext = React.createContext<string | undefined>(undefined);

const Text = React.forwardRef<TextRef, SlottableTextProps>(
  ({ className, asChild = false, style, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    
    // Parse the textClass context to get the color
    let contextStyle = {};
    if (textClass) {
      const colorMatch = textClass.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        contextStyle = { color: colorMatch[1] };
      }
    }
    
    return (
      <Component
        style={[styles.baseText, contextStyle, style]}
        ref={ref}
        {...props}
      />
    );
  }
);
Text.displayName = 'Text';

export { Text, TextClassContext };

const styles = StyleSheet.create({
  baseText: {
    fontSize: 16,
    lineHeight: 20,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
});
