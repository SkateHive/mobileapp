import type { TextRef, ViewRef } from '@rn-primitives/types';
import * as React from 'react';
import { Text, TextProps, View, ViewProps, StyleSheet } from 'react-native';
import { TextClassContext } from '~/components/ui/text';
import { theme } from '~/lib/theme';

const Card = React.forwardRef<ViewRef, ViewProps>(({ className, style, ...props }, ref) => (
  <View
    ref={ref}
    style={[styles.card, style]}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<ViewRef, ViewProps>(({ className, style, ...props }, ref) => (
  <View ref={ref} style={[styles.cardHeader, style]} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<TextRef, React.ComponentPropsWithoutRef<typeof Text>>(
  ({ className, style, ...props }, ref) => (
    <Text
      role='heading'
      aria-level={3}
      ref={ref}
      style={[styles.cardTitle, style]}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<TextRef, TextProps>(({ className, style, ...props }, ref) => (
  <Text ref={ref} style={[styles.cardDescription, style]} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<ViewRef, ViewProps>(({ className, style, ...props }, ref) => (
  <TextClassContext.Provider value='text-card-foreground'>
    <View ref={ref} style={[styles.cardContent, style]} {...props} />
  </TextClassContext.Provider>
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<ViewRef, ViewProps>(({ className, style, ...props }, ref) => (
  <View ref={ref} style={[styles.cardFooter, style]} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'column',
    padding: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: 24,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  cardDescription: {
    fontSize: 14,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  cardContent: {
    padding: theme.spacing.xl,
    paddingTop: 0,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingTop: 0,
  },
});
