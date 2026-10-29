import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { t } from "~/lib/i18n";

/** Shown in place of a map when the device can't draw one (see map-availability). */
export function MapUnavailable() {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={48} color={theme.colors.gray} />
      <Text style={styles.title}>{t("map.unavailable.title")}</Text>
      <Text style={styles.body}>{t("map.unavailable.body")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    textAlign: "center",
  },
  body: {
    color: theme.colors.gray,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    textAlign: "center",
  },
});
