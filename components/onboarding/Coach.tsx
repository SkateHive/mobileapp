import { View, Image, Pressable, Modal, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { useOnboardingStep, type OnboardingStep } from "~/lib/onboarding";

/**
 * The coach who explains the app (#68).
 *
 * Same pixel punk and white balloon as skate-dice, on purpose — he is already
 * part of this app's language, so onboarding reads as SkateHive rather than as
 * a template dropped on top. He is drawn over whatever is on screen instead of
 * replacing it: the point is to explain the thing the user is looking at.
 */
export function Coach({
  text,
  primaryLabel = "Got it",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  text: string;
  primaryLabel?: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    // A modal so a tip mounted deep inside a card or under a bottom sheet still
    // covers the screen it is explaining.
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onPrimary}>
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        {/* Swallows taps so a tip can't be dismissed by accidentally hitting
            the screen underneath — the buttons are the only way out. */}
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={() => {}} />

        <Animated.View entering={FadeInUp.duration(260)} style={styles.balloonWrap}>
          <View style={styles.balloon}>
            <Text style={styles.balloonText}>{text}</Text>

            {/* Inside the balloon, not under it: sitting below, they wedged
                themselves between the tail and his head, and he read as
                decoration next to a dialog rather than the one talking. */}
            <View style={styles.actions}>
              {secondaryLabel && onSecondary ? (
                <Pressable onPress={onSecondary} hitSlop={12} style={styles.skip}>
                  <Text style={styles.skipText}>{secondaryLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onPrimary}
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{primaryLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.tail} />
            <View style={styles.tailInner} />
          </View>
        </Animated.View>

        <Image
          source={require("~/assets/images/skatehive-coach2.png")}
          style={styles.character}
          resizeMode="contain"
        />
      </Animated.View>
    </Modal>
  );
}

/**
 * A single line, shown the first time someone reaches the thing it explains.
 * Self-gating: drop it in a screen and it decides whether to appear.
 */
export function CoachTip({
  step,
  text,
  enabled = true,
}: {
  step: OnboardingStep;
  text: string;
  enabled?: boolean;
}) {
  const { show, dismiss } = useOnboardingStep(step, enabled);
  if (!show) return null;
  return <Coach text={text} onPrimary={dismiss} />;
}

const styles = StyleSheet.create({
  // Light enough that the thing being explained is still visible behind it —
  // the balloon is white, so legibility survives the dimmer scrim.
  scrim: { backgroundColor: "rgba(0,0,0,0.6)" },
  character: {
    position: "absolute",
    bottom: -52,
    left: 0,
    right: 0,
    width: "100%",
    aspectRatio: 1341 / 1173,
  },
  // Anchored to its bottom rather than to the top of the screen, so the tail
  // keeps the same short distance from his head whatever the length of the
  // line. His hair reaches 32% of the screen and the tail hangs ~2% below the
  // balloon, so 38% leaves the tail pointing at him without resting on him.
  balloonWrap: {
    position: "absolute",
    bottom: "38%",
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 2,
  },
  balloon: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 3,
    borderColor: "#0c0c0c",
  },
  balloonText: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: theme.fonts.regular,
    color: "#15151a",
  },
  // Balloon tail: a black wedge with a white one just inside it, so the border
  // reads as continuous.
  tail: {
    position: "absolute",
    bottom: -16,
    right: 100,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0c0c0c",
  },
  tailInner: {
    position: "absolute",
    bottom: -9,
    right: 104,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  skip: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm },
  skipText: {
    color: theme.auth.textSecondary,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
  },
  primary: {
    minHeight: 44,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.neon,
  },
  primaryPressed: { backgroundColor: theme.auth.neonPressed },
  primaryText: {
    color: theme.auth.onNeon,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
});
