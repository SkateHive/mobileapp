import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { AuthBackground } from "~/components/auth/AuthBackground";
import { Coach } from "~/components/onboarding/Coach";
import { markStepSeen } from "~/lib/onboarding";
import { theme } from "~/lib/theme";
import { t } from "~/lib/i18n";

/**
 * The two things a new skater has to know before touching anything (#68).
 *
 * Only two, and only here: everything else the coach has to say waits for the
 * screen it belongs to, where it actually means something. These two can't
 * wait — someone can post in the first thirty seconds, and a post is public,
 * permanent, and for now goes out under someone else's name.
 *
 * `about.tsx` is still the long version, reachable from the login screen's info
 * button. It is deliberately not linked from here: this is two lines and a way
 * in, not a reading list on someone's first minute in the app.
 */
const LINES = [t("auth.onboarding.line_1"), t("auth.onboarding.line_2")];

export default function OnboardingScreen() {
  const [i, setI] = useState(0);

  const leave = () => {
    void markStepSeen("intro");
    router.replace("/(tabs)/videos");
  };

  return (
    <View style={styles.container}>
      <AuthBackground scrim="top" />
      <Coach
        text={LINES[i]}
        primaryLabel={i === LINES.length - 1 ? t("auth.onboarding.lets_skate") : t("common.next")}
        onPrimary={() => (i === LINES.length - 1 ? leave() : setI(i + 1))}
        secondaryLabel={t("common.skip")}
        onSecondary={leave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
});
