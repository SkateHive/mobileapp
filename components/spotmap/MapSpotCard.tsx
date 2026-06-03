import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { formatDistance } from "~/lib/spotmap/geo";
import type { SpotmapRow } from "~/lib/spotmap/types";
import { isHiveSpot } from "~/lib/spotmap/types";

interface MapSpotCardProps {
  spot: SpotmapRow;
  /** Distance from the user, in km, if geolocation is available. */
  distanceKm?: number | null;
  /** Highlighted when its marker is tapped / focused. */
  highlighted?: boolean;
  onPress: (spot: SpotmapRow) => void;
  /** Long-press focuses the map on this spot. */
  onLongPress?: (spot: SpotmapRow) => void;
}

function MapSpotCardImpl({
  spot,
  distanceKm,
  highlighted,
  onPress,
  onLongPress,
}: MapSpotCardProps) {
  const [imgErrored, setImgErrored] = React.useState(false);
  const hive = isHiveSpot(spot);
  const showImage = !!spot.thumbnail && !imgErrored;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(spot);
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress?.(spot);
      }}
      style={[styles.card, highlighted && styles.cardHighlighted]}
    >
      <View style={styles.thumbWrap}>
        {showImage ? (
          <Image
            source={{ uri: spot.thumbnail! }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
            onError={() => setImgErrored(true)}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text style={styles.thumbEmoji}>🛹</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {spot.name || "Unnamed spot"}
        </Text>

        <View style={styles.metaRow}>
          {hive ? (
            <Text style={styles.author} numberOfLines={1}>
              @{spot.hive_author}
            </Text>
          ) : (
            <View style={styles.curatedBadge}>
              <Ionicons name="map" size={10} color={theme.colors.muted} />
              <Text style={styles.curatedText}>Curated</Text>
            </View>
          )}
          {distanceKm != null && (
            <Text style={styles.distance}>
              📍 {formatDistance(distanceKm)}
            </Text>
          )}
        </View>

        {!!spot.address && (
          <Text style={styles.address} numberOfLines={1}>
            {spot.address}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.colors.gray}
        style={styles.chevron}
      />
    </Pressable>
  );
}

export const MapSpotCard = React.memo(MapSpotCardImpl);

const THUMB = 64;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardHighlighted: {
    backgroundColor: "rgba(50, 205, 50, 0.08)",
    borderColor: theme.colors.primary,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.secondaryCard,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmoji: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.white,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  author: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.primary,
    flexShrink: 1,
  },
  curatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  curatedText: {
    fontSize: theme.fontSizes.xxs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    textTransform: "uppercase",
  },
  distance: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
  },
  address: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.gray,
  },
  chevron: {
    marginLeft: theme.spacing.xs,
  },
});
