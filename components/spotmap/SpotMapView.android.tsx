// The spot map on Android: MapLibre with OpenFreeMap tiles. It needs no API
// key and no Google Play services, so it also works on GrapheneOS and other
// de-Googled phones. It mirrors the part of the react-native-maps API that the
// screens use, so they import SpotMapView without caring which map draws.
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as Location from "expo-location";
import {
  Camera,
  Map,
  NativeUserLocation,
  ViewAnnotation,
  type Anchor,
  type CameraRef,
  type LngLatBounds,
  type ViewAnnotationRef,
} from "@maplibre/maplibre-react-native";
import { theme } from "~/lib/theme";
import type { Region } from "~/lib/spotmap/geo";
import { MapUnavailable } from "./MapUnavailable";

// Free, keyless vector tiles. tile.openstreetmap.org forbids app traffic.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

// The screens pass it to react-native-maps; MapLibre has no providers.
export const PROVIDER_DEFAULT = undefined;

type LatLng = { latitude: number; longitude: number };
type EdgePadding = { top: number; right: number; bottom: number; left: number };

export interface SpotMapHandle {
  animateToRegion(region: Region, duration?: number): void;
  fitToCoordinates(
    coords: LatLng[],
    options?: { edgePadding?: EdgePadding; animated?: boolean },
  ): void;
}

interface SpotMapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  region?: Region;
  onMapReady?: () => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
  showsUserLocation?: boolean;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
  children?: React.ReactNode;
  // react-native-maps options with no MapLibre equivalent; ignored here.
  provider?: unknown;
  userInterfaceStyle?: "light" | "dark";
  showsMyLocationButton?: boolean;
  showsPointsOfInterest?: boolean;
  toolbarEnabled?: boolean;
}

const WORLD: Region = { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
const ONE_SPOT_ZOOM = 15;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function regionToLngLatBounds(r: Region): LngLatBounds {
  return [
    clamp(r.longitude - r.longitudeDelta / 2, -180, 180),
    clamp(r.latitude - r.latitudeDelta / 2, -85, 85),
    clamp(r.longitude + r.longitudeDelta / 2, -180, 180),
    clamp(r.latitude + r.latitudeDelta / 2, -85, 85),
  ];
}

function lngLatBoundsToRegion(
  [west, south, east, north]: LngLatBounds,
  [lng, lat]: [number, number],
): Region {
  // A view across the antimeridian has east < west.
  const lngSpan = east >= west ? east - west : east + 360 - west;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: Math.abs(north - south),
    longitudeDelta: lngSpan,
  };
}

// Camera calls throw until the native map exists; a move that early is
// dropped the same way react-native-maps drops it before onMapReady.
function moveCamera(move: () => Promise<void> | void) {
  try {
    const p = move();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

export const SpotMapView = React.forwardRef<SpotMapHandle, SpotMapViewProps>(
  function SpotMapView(
    {
      style,
      initialRegion,
      region,
      onMapReady,
      onRegionChangeComplete,
      onPress,
      showsUserLocation,
      pointerEvents,
      children,
    },
    ref,
  ) {
    const camera = React.useRef<CameraRef>(null);
    const loaded = React.useRef(false);
    const [failed, setFailed] = React.useState(false);
    const [initialBounds] = React.useState(() =>
      regionToLngLatBounds(initialRegion ?? region ?? WORLD),
    );

    React.useImperativeHandle(
      ref,
      () => ({
        animateToRegion(r, duration = 500) {
          moveCamera(() =>
            camera.current?.fitBounds(regionToLngLatBounds(r), { duration, easing: "ease" }),
          );
        },
        fitToCoordinates(coords, options) {
          if (!coords.length) return;
          const duration = options?.animated === false ? 0 : 500;
          const padding = options?.edgePadding;
          const lats = coords.map((c) => c.latitude);
          const lngs = coords.map((c) => c.longitude);
          const bounds: LngLatBounds = [
            Math.min(...lngs),
            Math.min(...lats),
            Math.max(...lngs),
            Math.max(...lats),
          ];
          // A single point has no extent to fit; centre on it at street level.
          if (bounds[0] === bounds[2] && bounds[1] === bounds[3]) {
            moveCamera(() =>
              camera.current?.easeTo({
                center: [bounds[0], bounds[1]],
                zoom: ONE_SPOT_ZOOM,
                padding,
                duration,
              }),
            );
            return;
          }
          moveCamera(() =>
            camera.current?.fitBounds(bounds, { padding, duration, easing: "ease" }),
          );
        },
      }),
      [],
    );

    // A controlled `region` moves the map whenever it changes, as in
    // react-native-maps. The first value is already the initial view.
    const regionKey = region
      ? `${region.latitude},${region.longitude},${region.latitudeDelta},${region.longitudeDelta}`
      : "";
    const firstRegion = React.useRef(true);
    React.useEffect(() => {
      if (firstRegion.current) {
        firstRegion.current = false;
        return;
      }
      if (!region) return;
      moveCamera(() =>
        camera.current?.fitBounds(regionToLngLatBounds(region), { duration: 0 }),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionKey]);

    // The location layer needs the permission; a location restored from a
    // previous session can arrive after the permission was revoked.
    const [locationAllowed, setLocationAllowed] = React.useState(false);
    React.useEffect(() => {
      if (!showsUserLocation) {
        setLocationAllowed(false);
        return;
      }
      let live = true;
      Location.getForegroundPermissionsAsync()
        .then((p) => live && setLocationAllowed(p.granted))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [showsUserLocation]);

    if (failed) return <MapUnavailable />;

    const interactive = pointerEvents !== "none";

    return (
      <View style={[styles.host, style]} pointerEvents={pointerEvents}>
        <Map
          style={styles.map}
          mapStyle={MAP_STYLE}
          logo={false}
          compass={false}
          // OpenStreetMap data needs visible credit; the bottom of the Map
          // tab is covered by its sheet, so the credit sits up top.
          attributionPosition={{ top: 64, left: 8 }}
          dragPan={interactive}
          touchZoom={interactive}
          doubleTapZoom={interactive}
          touchRotate={false}
          touchPitch={false}
          onDidFinishLoadingMap={() => {
            // react-native-maps fires onMapReady once; the screens recenter
            // the map in it, so a second call would move it again.
            if (loaded.current) return;
            loaded.current = true;
            onMapReady?.();
          }}
          onDidFailLoadingMap={() => setFailed(true)}
          onRegionDidChange={(e) => {
            const { bounds, center } = e.nativeEvent;
            onRegionChangeComplete?.(lngLatBoundsToRegion(bounds, center));
          }}
          onPress={(e) => {
            const [longitude, latitude] = e.nativeEvent.lngLat;
            onPress?.({ nativeEvent: { coordinate: { latitude, longitude } } });
          }}
        >
          <Camera ref={camera} initialViewState={{ bounds: initialBounds }} />
          {showsUserLocation && locationAllowed ? <NativeUserLocation /> : null}
          {children}
        </Map>
      </View>
    );
  },
);

interface SpotMapMarkerProps {
  coordinate: LatLng;
  onPress?: (e: { stopPropagation: () => void }) => void;
  anchor?: { x: number; y: number };
  draggable?: boolean;
  onDragEnd?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
  children?: React.ReactElement;
  // As in react-native-maps: redraw the marker's image while true.
  tracksViewChanges?: boolean;
}

function toAnchor(a?: { x: number; y: number }): Anchor {
  if (!a) return "center";
  const v = a.y < 0.25 ? "top" : a.y > 0.75 ? "bottom" : "";
  const h = a.x < 0.25 ? "left" : a.x > 0.75 ? "right" : "";
  return ((v && h ? `${v}-${h}` : v || h) || "center") as Anchor;
}

export function SpotMapMarker({
  coordinate,
  onPress,
  anchor,
  draggable,
  onDragEnd,
  tracksViewChanges = false,
  children,
}: SpotMapMarkerProps) {
  const annotation = React.useRef<ViewAnnotationRef>(null);

  // Android draws the marker's view into a bitmap, redrawn by itself only when
  // its size changes. Redraw on render only while the marker asks for it, and
  // once more when it stops (to keep the final look, e.g. un-highlighted).
  // Each redraw copies the bitmap into the Java heap, so redrawing every
  // marker on every render runs the app out of memory.
  const wasTracking = React.useRef(tracksViewChanges);
  React.useEffect(() => {
    if (tracksViewChanges || wasTracking.current) annotation.current?.refresh();
    wasTracking.current = tracksViewChanges;
  });

  return (
    <ViewAnnotation
      ref={annotation}
      lngLat={[coordinate.longitude, coordinate.latitude]}
      anchor={toAnchor(anchor)}
      draggable={draggable}
      onPress={() => onPress?.({ stopPropagation() {} })}
      onDragEnd={(e) => {
        const [longitude, latitude] = e.nativeEvent.lngLat;
        onDragEnd?.({ nativeEvent: { coordinate: { latitude, longitude } } });
      }}
    >
      {children ?? <View style={styles.defaultPin} />}
    </ViewAnnotation>
  );
}

const styles = StyleSheet.create({
  host: { overflow: "hidden", backgroundColor: theme.colors.background },
  map: { flex: 1 },
  defaultPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.black,
  },
});
