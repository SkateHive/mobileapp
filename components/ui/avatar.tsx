import * as AvatarPrimitive from '@rn-primitives/avatar';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '~/lib/theme';

const AvatarPrimitiveRoot = AvatarPrimitive.Root;
const AvatarPrimitiveImage = AvatarPrimitive.Image;
const AvatarPrimitiveFallback = AvatarPrimitive.Fallback;

const Avatar = React.forwardRef<AvatarPrimitive.RootRef, AvatarPrimitive.RootProps>(
  ({ className, style, ...props }, ref) => (
    <AvatarPrimitiveRoot
      ref={ref}
      style={[styles.root, style]}
      {...props}
    />
  )
);
Avatar.displayName = AvatarPrimitiveRoot.displayName;

const AvatarImage = React.forwardRef<AvatarPrimitive.ImageRef, AvatarPrimitive.ImageProps>(
  ({ className, style, ...props }, ref) => (
    <AvatarPrimitiveImage
      ref={ref}
      style={[styles.image, style]}
      {...props}
    />
  )
);
AvatarImage.displayName = AvatarPrimitiveImage.displayName;

const AvatarFallback = React.forwardRef<AvatarPrimitive.FallbackRef, AvatarPrimitive.FallbackProps>(
  ({ className, style, ...props }, ref) => (
    <AvatarPrimitiveFallback
      ref={ref}
      style={[styles.fallback, style]}
      {...props}
    />
  )
);
AvatarFallback.displayName = AvatarPrimitiveFallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    height: 40,
    width: 40,
    overflow: 'hidden',
    borderRadius: 20,
  },
  image: {
    aspectRatio: 1,
    height: '100%',
    width: '100%',
  },
  fallback: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: theme.colors.muted,
  },
});
