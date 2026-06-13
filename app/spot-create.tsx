import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, Marker, type Region } from "react-native-maps";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import { uploadImageToHive, createImageMarkdown } from "~/lib/upload/image-upload";
import { uploadVideoToWorker, createVideoIframe } from "~/lib/upload/video-upload";
import { submitSpot } from "~/lib/spotmap/createSpot";
import { syncOneSpot } from "~/lib/spotmap/api";
import { syncSpotWidget } from "~/lib/widgets/spotWidget";
import { persistUserLoc } from "~/lib/hooks/useSpotWidgetSync";
import type { SpotmapRow } from "~/lib/spotmap/types";

interface MediaAsset {
  uri: string;
  type: "image" | "video";
  mimeType: string;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime",
  webm: "video/webm",
};

function assetToMedia(asset: ImagePicker.ImagePickerAsset): MediaAsset {
  const type: "image" | "video" = asset.type === "video" ? "video" : "image";
  const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "";
  return {
    uri: asset.uri,
    type,
    mimeType: asset.mimeType || MIME_BY_EXT[ext] || (type === "video" ? "video/mp4" : "image/jpeg"),
  };
}

export default function SpotCreateScreen() {
  const { username, session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const mapRef = useRef<MapView | null>(null);

  // Resolve GPS on open and drop the initial pin.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setLocating(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 });
        reverseGeocode(lat, lng);
      } catch {
        // Leave the map at a draggable default; user can place the pin manually.
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const r = results?.[0];
      if (r) {
        const parts = [r.name || r.street, r.city || r.subregion, r.country].filter(Boolean);
        setAddress(parts.join(", ") || null);
      }
    } catch {
      // Address is a nicety; coordinates are what matter.
    }
  };

  const onMarkerDragEnd = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoords({ lat: latitude, lng: longitude });
    reverseGeocode(latitude, longitude);
  };

  const addFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 6,
        quality: 0.75,
        exif: false,
      });
      if (!result.canceled && result.assets?.length) {
        setMedia((prev) => [...prev, ...result.assets.map(assetToMedia)].slice(0, 6));
      }
    } catch {
      Alert.alert("Error", "Failed to pick media.");
    }
  };

  const addFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera access needed", "Enable camera access to capture a spot.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.75,
        exif: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setMedia((prev) => [...prev, assetToMedia(result.assets[0])].slice(0, 6));
      }
    } catch {
      Alert.alert("Error", "Failed to open camera.");
    }
  };

  const removeMedia = (uri: string) => setMedia((prev) => prev.filter((m) => m.uri !== uri));

  const canSubmit = !submitting && name.trim().length > 0 && !!coords;

  const handleSubmit = async () => {
    if (!username || !session?.decryptedKey) {
      Alert.alert("Login required", "You need to be logged in to add a spot.");
      return;
    }
    if (!coords) {
      Alert.alert("Location needed", "Place the pin on the spot's location first.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Name needed", "Give the spot a name.");
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      const videoIframes: string[] = [];

      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        const fileName = m.uri.split("/").pop() || `spot-${i}`;
        if (m.type === "image") {
          setProgress(`Uploading photo ${i + 1}/${media.length}…`);
          const res = await uploadImageToHive(m.uri, fileName, m.mimeType, {
            username,
            privateKey: session.decryptedKey,
          });
          imageUrls.push(createImageMarkdown(res.url, "spot"));
        } else {
          setProgress(`Uploading video ${i + 1}/${media.length}…`);
          const res = await uploadVideoToWorker(m.uri, fileName, m.mimeType, {
            creator: username,
            onProgress: (p, stage) => setProgress(`Video ${stage} ${p}%`),
          });
          videoIframes.push(createVideoIframe(res.gatewayUrl, "Spot"));
        }
      }

      setProgress("Posting spot to Hive…");
      const { author, permlink } = await submitSpot({
        username,
        privateKey: session.decryptedKey,
        name: name.trim(),
        lat: coords.lat,
        lng: coords.lng,
        address,
        description,
        media: { imageUrls, videoIframes },
      });

      // Optimistic pin: show it on the map immediately while the server ingests.
      const firstImageUrl = imageUrls[0]?.match(/\((https?:\/\/[^)]+)\)/)?.[1] ?? null;
      const optimistic: SpotmapRow = {
        id: `${author}/${permlink}`,
        source: "hive",
        name: name.trim(),
        description: description || null,
        lat: coords.lat,
        lng: coords.lng,
        address,
        thumbnail: firstImageUrl,
        images: firstImageUrl ? [{ url: firstImageUrl, caption: "spot" }] : null,
        hive_author: author,
        hive_permlink: permlink,
        hive_created: new Date().toISOString(),
      };
      queryClient.setQueryData<SpotmapRow[]>(["spotmap", "all"], (old) =>
        old ? [optimistic, ...old.filter((s) => s.id !== optimistic.id)] : [optimistic]
      );

      // Targeted server ingestion so it appears for everyone within seconds,
      // then refetch the canonical list. Best-effort — the optimistic pin and
      // daily reconciliation cover the case where the RPC hasn't propagated yet.
      setProgress("Adding to the map…");
      const synced = await syncOneSpot(author, permlink);
      if (synced) {
        queryClient.invalidateQueries({ queryKey: ["spotmap", "all"] });
      }

      // Keep the widget fresh with the new spot included.
      persistUserLoc({ lat: coords.lat, lng: coords.lng });
      const spots = queryClient.getQueryData<SpotmapRow[]>(["spotmap", "all"]) ?? [optimistic];
      syncSpotWidget({ lat: coords.lat, lng: coords.lng }, spots);

      showToast("Spot added!", "success");
      router.replace("/(tabs)/map");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add spot.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Spot</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Media */}
        <View style={styles.mediaRow}>
          <Pressable style={styles.mediaBtn} onPress={addFromCamera}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.mediaBtn} onPress={addFromLibrary}>
            <Ionicons name="images-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Library</Text>
          </Pressable>
        </View>

        {media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
            {media.map((m) => (
              <View key={m.uri} style={styles.thumbWrap}>
                <Image source={{ uri: m.uri }} style={styles.thumb} />
                {m.type === "video" && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                )}
                <Pressable style={styles.thumbRemove} onPress={() => removeMedia(m.uri)}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Location */}
        <Text style={styles.label}>📍 Location</Text>
        <View style={styles.mapWrap}>
          {locating ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.hint}>Finding your location…</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              region={region ?? undefined}
              initialRegion={
                region ?? { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 }
              }
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setCoords({ lat: latitude, lng: longitude });
                reverseGeocode(latitude, longitude);
              }}
            >
              {coords && (
                <Marker
                  draggable
                  coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                  onDragEnd={onMarkerDragEnd}
                />
              )}
            </MapView>
          )}
        </View>
        {coords ? (
          <Text style={styles.coordsText}>
            {address ? `${address}\n` : ""}
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · drag the pin to fine-tune
          </Text>
        ) : (
          !locating && <Text style={styles.hint}>Tap the map to place the spot.</Text>
        )}

        {/* Name */}
        <Text style={styles.label}>Spot name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Praça XV ledges"
          placeholderTextColor={theme.colors.muted}
          value={name}
          onChangeText={setName}
          maxLength={80}
        />

        {/* Description */}
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Surface, obstacles, best time to skate…"
          placeholderTextColor={theme.colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <View style={styles.submitRow}>
              <ActivityIndicator color="#000" />
              <Text style={styles.submitText}>{progress || "Submitting…"}</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Submit Spot</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.lg, color: theme.colors.text },
  body: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl * 2, gap: theme.spacing.sm },
  mediaRow: { flexDirection: "row", gap: theme.spacing.md },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondaryCard,
  },
  mediaBtnText: { color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md },
  thumbStrip: { flexGrow: 0 },
  thumbWrap: { marginRight: theme.spacing.sm },
  thumb: { width: 84, height: 84, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.secondaryCard },
  videoBadge: {
    position: "absolute", bottom: 4, left: 4,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, padding: 2,
  },
  thumbRemove: { position: "absolute", top: -6, right: -6, backgroundColor: theme.colors.background, borderRadius: 10 },
  label: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
    marginTop: theme.spacing.sm,
  },
  mapWrap: {
    height: 200,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  coordsText: { color: theme.colors.muted, fontFamily: theme.fonts.regular, fontSize: theme.fontSizes.xs },
  hint: { color: theme.colors.muted, fontFamily: theme.fonts.regular, fontSize: theme.fontSizes.sm },
  input: {
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  submit: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.4 },
  submitRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  submitText: { color: "#000", fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md },
});
