import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { t } from "~/lib/i18n";
import { googleMapsUrl } from "~/lib/spotmap/parseSpotBody";

interface Props {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}

// Rich, tappable location header for spot posts: 🌐 + spot name hyperlinked to
// Google Maps, with the street address as muted subtext.
export function SpotLocationLine({ name, lat, lng, address }: Props) {
  const open = () => {
    Linking.openURL(googleMapsUrl(lat, lng)).catch(() => {});
  };

  return (
    <Pressable
      onPress={open}
      style={styles.row}
      accessibilityRole="link"
      accessibilityLabel={t("map.location_line.a11y", { name })}
    >
      <Text style={styles.globe}>🌐</Text>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {address ? (
          <Text style={styles.address} numberOfLines={2}>
            {address}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={15} color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm + 2,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondaryCard,
  },
  globe: { fontSize: 16 },
  body: { flex: 1 },
  name: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    textDecorationLine: "underline",
  },
  address: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    marginTop: 1,
  },
});
