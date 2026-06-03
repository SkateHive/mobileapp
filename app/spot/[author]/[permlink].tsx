import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "~/components/ui/text";
import { EnhancedMarkdownRenderer } from "~/components/markdown/EnhancedMarkdownRenderer";
import { theme } from "~/lib/theme";
import { useAllSpots, useSpot } from "~/lib/hooks/useSpotmap";
import { parseKmlDescription } from "~/lib/spotmap/parseKmlDescription";
import { KML_AUTHOR, type SpotmapRow } from "~/lib/spotmap/types";

function relativeDate(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export default function SpotDetailScreen() {
  const { author, permlink } = useLocalSearchParams<{
    author: string;
    permlink: string;
  }>();
  const { width } = useWindowDimensions();

  const isKml = author === KML_AUTHOR;

  // KML permlink IS the row uuid → fetch directly. Hive spots need the list
  // to map (author, permlink) → uuid.
  const { data: allSpots } = useAllSpots();
  const baseRow = React.useMemo<SpotmapRow | undefined>(() => {
    if (!allSpots) return undefined;
    if (isKml) return allSpots.find((s) => s.id === permlink);
    return allSpots.find(
      (s) => s.hive_author === author && s.hive_permlink === permlink,
    );
  }, [allSpots, author, permlink, isKml]);

  const spotId = isKml ? permlink : baseRow?.id;
  const { data: detail, isLoading } = useSpot(spotId);

  const spot = detail ?? baseRow;

  const images = React.useMemo<string[]>(() => {
    if (!spot) return [];
    const urls: string[] = [];
    spot.images?.forEach((i) => i?.url && urls.push(i.url));
    if (isKml && spot.kml_description) {
      parseKmlDescription(spot.kml_description).images.forEach((u) =>
        urls.push(u),
      );
    }
    if (!urls.length && spot.thumbnail) urls.push(spot.thumbnail);
    return Array.from(new Set(urls));
  }, [spot, isKml]);

  const aboutText = React.useMemo(() => {
    if (!spot) return "";
    if (isKml) return parseKmlDescription(spot.kml_description).text;
    return spot.description ?? "";
  }, [spot, isKml]);

  const openDirections = React.useCallback(() => {
    if (!spot) return;
    Haptics.selectionAsync();
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`,
    );
  }, [spot]);

  const openInMaps = React.useCallback(() => {
    if (!spot) return;
    Haptics.selectionAsync();
    Linking.openURL(`https://www.google.com/maps?q=${spot.lat},${spot.lng}`);
  }, [spot]);

  const openDiscussion = React.useCallback(() => {
    router.push({
      pathname: "/conversation",
      params: { author: author!, permlink: permlink! },
    });
  }, [author, permlink]);

  if (!spot && isLoading) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!spot) {
    return (
      <View style={styles.container}>
        <Header title="Spot" />
        <View style={styles.centerFill}>
          <Text style={styles.muted}>Spot not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={spot.name || "Spot"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Image carousel */}
        {images.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width }}
          >
            {images.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                style={{ width, height: width * 0.7 }}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.section}>
          <Text style={styles.name}>{spot.name || "Unnamed spot"}</Text>

          {/* Source attribution */}
          {isKml ? (
            <View style={styles.curatedBadge}>
              <Ionicons name="map" size={14} color={theme.colors.muted} />
              <Text style={styles.curatedText}>
                From the curated Google My Maps dataset
              </Text>
            </View>
          ) : (
            <Pressable
              style={styles.authorRow}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/profile",
                  params: { username: spot.hive_author ?? "" },
                })
              }
            >
              <Text style={styles.author}>@{spot.hive_author}</Text>
              {!!spot.hive_created && (
                <Text style={styles.muted}>
                  {" · "}
                  {relativeDate(spot.hive_created)}
                </Text>
              )}
            </Pressable>
          )}

          {!!spot.address && (
            <Text style={styles.address}>{spot.address}</Text>
          )}
        </View>

        {/* About */}
        {!!aboutText && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About this spot</Text>
            {isKml ? (
              <Text style={styles.kmlText}>{aboutText}</Text>
            ) : (
              <EnhancedMarkdownRenderer content={aboutText} />
            )}
          </View>
        )}

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <View style={styles.miniMapWrap}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={styles.miniMap}
              pointerEvents="none"
              userInterfaceStyle="dark"
              initialRegion={{
                latitude: spot.lat,
                longitude: spot.lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
                <View style={styles.pin}>
                  <Text style={styles.pinEmoji}>🛹</Text>
                </View>
              </Marker>
            </MapView>
          </View>
          <Text style={styles.coords}>
            {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.actionPrimary} onPress={openDirections}>
            <Ionicons name="navigate" size={18} color={theme.colors.black} />
            <Text style={styles.actionPrimaryText}>Directions</Text>
          </Pressable>
          <Pressable style={styles.actionSecondary} onPress={openInMaps}>
            <Ionicons name="map-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.actionSecondaryText}>Open in Maps</Text>
          </Pressable>
        </View>

        {!isKml && (
          <Pressable style={styles.discussionBtn} onPress={openDiscussion}>
            <Ionicons
              name="chatbubbles-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.discussionText}>View discussion</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const goBack = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/map");
  };
  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <Pressable onPress={goBack} style={styles.backBtn} hitSlop={16}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: theme.spacing.xs, marginRight: theme.spacing.sm },
  headerTitle: {
    flex: 1,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.white,
  },
  scrollContent: { paddingBottom: theme.spacing.xxxl },
  section: { padding: theme.spacing.md, gap: theme.spacing.xs },
  name: {
    fontSize: theme.fontSizes.xxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.white,
  },
  authorRow: { flexDirection: "row", alignItems: "center" },
  author: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  curatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  curatedText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
  },
  address: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.gray,
  },
  muted: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
  },
  card: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondaryCard,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  kmlText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.white,
    lineHeight: 20,
  },
  miniMapWrap: {
    height: 160,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
  },
  miniMap: { ...StyleSheet.absoluteFillObject },
  coords: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.black,
  },
  pinEmoji: { fontSize: 15, lineHeight: 19 },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },
  actionPrimaryText: {
    color: theme.colors.black,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  actionSecondaryText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
  discussionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  discussionText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
  },
});
