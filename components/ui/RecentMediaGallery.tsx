import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { Text } from "./text";
import { theme } from "~/lib/theme";

interface MediaAsset {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
  creationTime: number;
  duration?: number;
}

interface RecentMediaGalleryProps {
  onMediaSelect: (asset: MediaAsset) => void;
  maxItems?: number;
}

export function RecentMediaGallery({
  onMediaSelect,
  maxItems = 20,
}: RecentMediaGalleryProps) {
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  // iOS shows the permission dialog once. After a refusal, requesting again
  // returns "denied" without presenting anything — which is why this button did
  // nothing at all (#29). Past that point the only route is the Settings app.
  const [canAskAgain, setCanAskAgain] = useState(true);

  const requestPermission = useCallback(async () => {
    try {
      const { status, canAskAgain: mayAsk } =
        await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === "granted");
      setCanAskAgain(mayAsk);
      return status === "granted";
    } catch (error) {
      console.error("Error requesting media library permission:", error);
      setHasPermission(false);
      return false;
    }
  }, []);

  // Read-only check. Never prompts, so it's safe to run at launch: changing
  // Photos access in Settings makes iOS kill the app, and the *request* call
  // issued while the relaunched app is still inactive never resolves — which is
  // what left this panel stuck on "Requesting permissions…" forever.
  const checkPermission = useCallback(async () => {
    try {
      const { status, canAskAgain: mayAsk } =
        await MediaLibrary.getPermissionsAsync();
      setHasPermission(status === "granted");
      setCanAskAgain(mayAsk);
    } catch {
      setHasPermission(false);
    }
  }, []);

  // Granting happens in Settings, which means leaving the app — so re-check on
  // the way back, or the user returns to the same panel they just fixed.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  const loadRecentMedia = useCallback(async () => {
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: MediaLibrary.SortBy.creationTime,
        first: maxItems,
      });

      const assets: MediaAsset[] = result.assets
        .filter(
          (asset) => asset.mediaType === "photo" || asset.mediaType === "video"
        )
        .map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          mediaType: asset.mediaType as "photo" | "video",
          creationTime: asset.creationTime,
          duration: asset.duration,
        }));

      setMediaAssets(assets);
    } catch (error) {
      console.error("Error loading media assets:", error);
      Alert.alert("Error", "Failed to load recent media");
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, maxItems]);

  // Only ever a read on mount. The prompt now belongs to the button, which also
  // means opening the composer no longer throws a system dialog at people who
  // just want to type.
  useEffect(() => {
    setIsLoading(false);
    checkPermission();
  }, [checkPermission]);

  // Load only once access is actually there — including when it arrives late,
  // from Settings.
  useEffect(() => {
    if (hasPermission) loadRecentMedia();
  }, [hasPermission, loadRecentMedia]);

  const handleMediaPress = useCallback(
    async (asset: MediaAsset) => {
      // MediaLibrary asset.uri is a Photos reference (ph:// / ph-upload:// on
      // iOS) which RN's networking can't upload. Resolve it to a real local
      // file:// path (downloading from iCloud if needed) before handing it off.
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        onMediaSelect({ ...asset, uri: info.localUri || asset.uri });
      } catch (error) {
        console.error("Error resolving media asset localUri:", error);
        onMediaSelect(asset);
      }
    },
    [onMediaSelect]
  );

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.statusText}>Checking photo access...</Text>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="images-outline" size={32} color={theme.colors.gray} />
          <Text style={styles.statusText}>Media access required</Text>
          <Text style={styles.subText}>
            {canAskAgain
              ? "Grant permission to view your recent photos and videos"
              : "Photo access is off. Turn it on in Settings to see your recent photos and videos here — or use Add media, which needs no permission."}
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={canAskAgain ? requestPermission : Linking.openSettings}
          >
            <Text style={styles.permissionButtonText}>
              {canAskAgain ? "Grant Permission" : "Open Settings"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.statusText}>Loading recent media...</Text>
        </View>
      </View>
    );
  }

  if (mediaAssets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={32} color={theme.colors.gray} />
          <Text style={styles.statusText}>No recent media found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Recent Media</Text>
        <Text style={styles.countText}>{mediaAssets.length} items</Text>
      </View>
      <View style={styles.gridContainer}>
        {mediaAssets.slice(0, 9).map((item, index) => (
          <Pressable
            key={item.id}
            style={styles.mediaItem}
            onPress={() => handleMediaPress(item)}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            {item.mediaType === "video" && (
              <View style={styles.videoIndicator}>
                <Ionicons name="play" size={16} color="white" />
                {item.duration && (
                  <Text style={styles.durationText}>
                    {Math.floor(item.duration / 60)}:
                    {Math.floor(item.duration % 60).toString().padStart(2, "0")}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    marginTop: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  headerText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  countText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gray,
    fontFamily: theme.fonts.regular,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  grid: {
    gap: theme.spacing.xxs,
  },
  mediaItem: {
    width: "33.33%", // 3 columns like Instagram
    aspectRatio: 1,
    position: "relative",
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  videoIndicator: {
    position: "absolute",
    bottom: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: theme.borderRadius.xs,
    padding: theme.spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
  },
  durationText: {
    color: "white",
    fontSize: theme.fontSizes.xxs,
    marginLeft: theme.spacing.xxs,
    fontFamily: theme.fonts.regular,
  },
  statusText: {
    color: theme.colors.gray,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  subText: {
    color: theme.colors.gray,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    textAlign: "center",
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.sm,
  },
  permissionContainer: {
    alignItems: "center",
    padding: theme.spacing.md,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  permissionButtonText: {
    color: theme.colors.black,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
  },
  emptyContainer: {
    alignItems: "center",
    padding: theme.spacing.md,
  },
});
