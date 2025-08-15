import * as TooltipPrimitive from '@rn-primitives/tooltip';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TextClassContext } from '~/components/ui/text';
import { theme } from '~/lib/theme';

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  TooltipPrimitive.ContentRef,
  TooltipPrimitive.ContentProps & { portalHost?: string }
>(({ className, sideOffset = 4, portalHost, style, ...props }, ref) => (
  <TooltipPrimitive.Portal hostName={portalHost}>
    <TooltipPrimitive.Overlay style={Platform.OS !== 'web' ? StyleSheet.absoluteFill : undefined}>
      <Animated.View
        entering={Platform.select({ web: undefined, default: FadeIn })}
        exiting={Platform.select({ web: undefined, default: FadeOut })}
      >
        <TextClassContext.Provider value='text-sm native:text-base text-popover-foreground'>
          <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            style={[styles.content, style] as any}
            {...props}
          />
        </TextClassContext.Provider>
      </Animated.View>
    </TooltipPrimitive.Overlay>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipTrigger };

const styles = StyleSheet.create({
  content: {
    zIndex: 50,
    overflow: 'hidden',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
});
