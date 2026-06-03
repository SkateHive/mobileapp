import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Marker } from "react-native-maps";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";
import type { SpotmapRow } from "~/lib/spotmap/types";

/**
 * Custom marker views on iOS snapshot themselves once, so they must render
 * with `tracksViewChanges` on until laid out, then turn it off (otherwise
 * the map re-rasterizes every marker on each frame and stutters badly).
 * This hook flips it false shortly after mount.
 */
function useSettledTracking(): boolean {
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(t);
  }, []);
  return tracking;
}

interface SpotMarkerProps {
  spot: SpotmapRow;
  highlighted?: boolean;
  onPress: (spot: SpotmapRow) => void;
}

function SpotMarkerImpl({ spot, highlighted, onPress }: SpotMarkerProps) {
  const tracking = useSettledTracking();
  return (
    <Marker
      coordinate={{ latitude: spot.lat, longitude: spot.lng }}
      onPress={(e) => {
        // Stop the press from also dismissing/affecting the map.
        e.stopPropagation?.();
        onPress(spot);
      }}
      tracksViewChanges={tracking || highlighted}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={[
          styles.pin,
          highlighted && styles.pinHighlighted,
        ]}
      >
        <Text style={styles.pinEmoji}>🛹</Text>
      </View>
    </Marker>
  );
}

export const SpotMarker = React.memo(SpotMarkerImpl);

interface ClusterMarkerProps {
  latitude: number;
  longitude: number;
  count: number;
  onPress: () => void;
}

function ClusterMarkerImpl({
  latitude,
  longitude,
  count,
  onPress,
}: ClusterMarkerProps) {
  const tracking = useSettledTracking();
  // Bubble grows with the cluster size.
  const size = count < 10 ? 40 : count < 50 ? 50 : count < 200 ? 60 : 70;
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={[
          styles.cluster,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  );
}

export const ClusterMarker = React.memo(ClusterMarkerImpl);

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.black,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  pinHighlighted: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderColor: theme.colors.white,
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  pinEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  cluster: {
    backgroundColor: "rgba(50, 205, 50, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.black,
  },
  clusterText: {
    color: theme.colors.black,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
});
