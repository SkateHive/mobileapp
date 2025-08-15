import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { TextClassContext } from '~/components/ui/text';
import { theme } from '~/lib/theme';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon';
type HapticType = 'none' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  haptic?: HapticType;
};

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ style, variant = 'default', size = 'default', haptic = 'none', disabled, ...props }, ref) => {
    const handlePress = React.useCallback((e: any) => {
      switch (haptic) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
      props.onPress?.(e);
    }, [haptic, props.onPress]);

    const buttonStyles = [
      styles.base,
      styles[`size_${size}` as keyof typeof styles],
      styles[variant as keyof typeof styles],
      disabled && styles.disabled,
      style
    ].filter(Boolean);

    const getTextColor = () => {
      if (disabled) return theme.colors.disabled;
      
      switch (variant) {
        case 'destructive':
          return theme.colors.white;
        case 'outline':
          return theme.colors.text;
        case 'secondary':
          return theme.colors.background;
        case 'ghost':
          return theme.colors.text;
        case 'link':
          return theme.colors.primary;
        default:
          return theme.colors.background;
      }
    };

    return (
      <TextClassContext.Provider value={`color: ${getTextColor()}`}>
        <Pressable
          style={buttonStyles as any}
          ref={ref}
          role='button'
          disabled={disabled}
          {...props}
          onPress={handlePress}
        />
      </TextClassContext.Provider>
    );
  }
);
Button.displayName = 'Button';

export { Button };
export type { ButtonProps };

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 48, // Use minHeight instead of fixed height
    overflow: 'visible', // Ensure content is not clipped
  },
  default: {
    backgroundColor: theme.colors.primary,
  },
  destructive: {
    backgroundColor: theme.colors.danger,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  link: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  size_default: {
    minHeight: 48, // Use minHeight instead of fixed height
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  size_sm: {
    minHeight: 36, // Use minHeight instead of fixed height
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 12,
  },
  size_lg: {
    minHeight: 44, // Use minHeight instead of fixed height
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: 12,
  },
  size_xl: {
    minHeight: 56, // Use minHeight instead of fixed height
    paddingHorizontal: theme.spacing.xxxl,
    paddingVertical: theme.spacing.lg,
    borderRadius: 12,
  },
  size_icon: {
    height: 40,
    width: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
