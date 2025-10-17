import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
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

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === "granted");
      return status === "granted";
    } catch (error) {
      console.error("Error requesting media library permission:", error);
      setHasPermission(false);
      return false;
    }
  }, []);

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

  useEffect(() => {
    const initializeMedia = async () => {
      const granted = await requestPermission();
      if (granted) {
        await loadRecentMedia();
      } else {
        setIsLoading(false);
      }
    };

    initializeMedia();
  }, [requestPermission, loadRecentMedia]);

  const handleMediaPress = useCallback(
    (asset: MediaAsset) => {
      onMediaSelect(asset);
    },
    [onMediaSelect]
  );

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.statusText}>Requesting permissions...</Text>
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
            Grant permission to view your recent photos and videos
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
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
