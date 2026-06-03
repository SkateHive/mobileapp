import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import MapView, { PROVIDER_DEFAULT, type Region as RNRegion } from "react-native-maps";
import BottomSheet, {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";
import Supercluster from "supercluster";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import { useToast } from "~/lib/toast-provider";
import { useAllSpots } from "~/lib/hooks/useSpotmap";
import { MapSpotCard } from "~/components/spotmap/MapSpotCard";
import { SpotMarker, ClusterMarker } from "~/components/spotmap/SpotMarker";
import {
  spotsInRegion,
  regionToBounds,
  regionToZoom,
  distanceKm,
  type Region,
} from "~/lib/spotmap/geo";
import { spotHref, type SpotmapRow } from "~/lib/spotmap/types";

// A broad opening view — clustering keeps it readable until the user zooms in.
const INITIAL_REGION: Region = {
  latitude: 20,
  longitude: -30,
  latitudeDelta: 110,
  longitudeDelta: 110,
};

const SNAP_POINTS = ["22%", "55%", "88%"];

type ClusterFeature = Supercluster.PointFeature<{ spot: SpotmapRow }>;
type AnyFeature =
  | Supercluster.ClusterFeature<{ spot: SpotmapRow }>
  | ClusterFeature;

export default function MapScreen() {
  const {
    data: spots,
    isLoading,
    isError,
    refetch,
    isRefetching,
    dataUpdatedAt,
  } = useAllSpots();
  const { showToast } = useToast();

  // Refetch when returning to the map tab, but only if the cached set is
  // stale (>5 min) — keeps it fresh without spamming the edge cache.
  const FIVE_MIN = 5 * 60 * 1000;
  useFocusEffect(
    React.useCallback(() => {
      if (dataUpdatedAt && Date.now() - dataUpdatedAt > FIVE_MIN) {
        refetch();
      }
    }, [dataUpdatedAt, refetch, FIVE_MIN]),
  );

  const mapRef = React.useRef<MapView>(null);
  const sheetRef = React.useRef<BottomSheet>(null);
  const listRef = React.useRef<BottomSheetFlatListMethods>(null);
  const regionDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [region, setRegion] = React.useState<Region>(INITIAL_REGION);
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [userLoc, setUserLoc] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );

  // Build the cluster index once per spot set.
  const cluster = React.useMemo(() => {
    const index = new Supercluster<{ spot: SpotmapRow }>({
      radius: 56,
      maxZoom: 18,
    });
    if (spots?.length) {
      index.load(
        spots.map((spot) => ({
          type: "Feature",
          properties: { spot },
          geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
        })),
      );
    }
    return index;
  }, [spots]);

  // Markers visible at the current region/zoom (clustered).
  const features = React.useMemo<AnyFeature[]>(() => {
    if (!spots?.length) return [];
    const bounds = regionToBounds(region);
    const zoom = Math.max(0, Math.min(20, regionToZoom(region)));
    return cluster.getClusters(bounds, zoom) as AnyFeature[];
  }, [cluster, spots, region]);

  // The list shown in the sheet — every spot inside the visible box.
  const visibleSpots = React.useMemo(() => {
    if (!spots?.length) return [];
    const inView = spotsInRegion(spots, region);
    if (userLoc) {
      return inView
        .map((s) => ({
          spot: s,
          d: distanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng),
        }))
        .sort((a, b) => a.d - b.d);
    }
    return inView.map((s) => ({ spot: s, d: null as number | null }));
  }, [spots, region, userLoc]);

  const handleRegionChange = React.useCallback((r: RNRegion) => {
    if (regionDebounce.current) clearTimeout(regionDebounce.current);
    regionDebounce.current = setTimeout(() => setRegion(r), 150);
  }, []);

  // Marker tap → highlight, surface its card, lift the sheet to mid detent.
  const handleMarkerPress = React.useCallback(
    (spot: SpotmapRow) => {
      setHighlightedId(spot.id);
      sheetRef.current?.snapToIndex(1);
      const idx = visibleSpots.findIndex((v) => v.spot.id === spot.id);
      if (idx >= 0) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0.3,
          });
        });
      }
    },
    [visibleSpots],
  );

  // Tapping a cluster zooms to the level where it breaks apart.
  const handleClusterPress = React.useCallback(
    (clusterId: number, lat: number, lng: number) => {
      const zoom = Math.min(20, cluster.getClusterExpansionZoom(clusterId));
      const delta = 360 / 2 ** zoom;
      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        350,
      );
    },
    [cluster],
  );

  const handleCardPress = React.useCallback((spot: SpotmapRow) => {
    router.push(spotHref(spot) as any);
  }, []);

  // Long-press a card → fly the map to that spot.
  const handleCardLongPress = React.useCallback((spot: SpotmapRow) => {
    setHighlightedId(spot.id);
    mapRef.current?.fitToCoordinates(
      [{ latitude: spot.lat, longitude: spot.lng }],
      {
        edgePadding: { top: 120, right: 120, bottom: 320, left: 120 },
        animated: true,
      },
    );
    sheetRef.current?.snapToIndex(0);
  }, []);

  const handleNearMe = React.useCallback(async () => {
    Haptics.selectionAsync();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        showToast(
          "Enable location in Settings → Privacy → Location Services → Skatehive",
          "error",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      setUserLoc({ lat: latitude, lng: longitude });
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.4,
          longitudeDelta: 0.4,
        },
        500,
      );
    } catch {
      showToast("Couldn't get your location", "error");
    }
  }, [showToast]);

  React.useEffect(
    () => () => {
      if (regionDebounce.current) clearTimeout(regionDebounce.current);
    },
    [],
  );

  const total = spots?.length ?? 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={!!userLoc}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
      >
        {features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const props = f.properties as any;
          if (props.cluster) {
            return (
              <ClusterMarker
                key={`cluster-${props.cluster_id}`}
                latitude={lat}
                longitude={lng}
                count={props.point_count}
                onPress={() => handleClusterPress(props.cluster_id, lat, lng)}
              />
            );
          }
          const spot: SpotmapRow = props.spot;
          return (
            <SpotMarker
              key={spot.id}
              spot={spot}
              highlighted={highlightedId === spot.id}
              onPress={handleMarkerPress}
            />
          );
        })}
      </MapView>

      {/* Near Me */}
      <Pressable
        style={styles.fab}
        onPress={handleNearMe}
        accessibilityRole="button"
        accessibilityLabel="Find spots near me"
      >
        <Ionicons name="locate" size={22} color={theme.colors.primary} />
      </Pressable>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={SNAP_POINTS}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>SPOTS IN THIS VIEW</Text>
          <Text style={styles.sheetCount}>
            {visibleSpots.length} / {total}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Couldn't load spots.</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <BottomSheetFlatList
            ref={listRef}
            data={visibleSpots}
            keyExtractor={(item) => item.spot.id}
            renderItem={({ item }) => (
              <MapSpotCard
                spot={item.spot}
                distanceKm={item.d}
                highlighted={highlightedId === item.spot.id}
                onPress={handleCardPress}
                onLongPress={handleCardLongPress}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshing={isRefetching}
            onRefresh={refetch}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>
                  No spots here — pan or zoom out.
                </Text>
              </View>
            }
            onScrollToIndexFailed={() => {}}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fab: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: { elevation: 6 },
    }),
  },
  sheetBg: {
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetHandle: {
    backgroundColor: theme.colors.border,
    width: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.muted,
    letterSpacing: 1,
  },
  sheetCount: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  listContent: {
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.xxxl,
  },
  sep: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
    opacity: 0.5,
  },
  center: {
    paddingVertical: theme.spacing.xxl,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  retryText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
});
