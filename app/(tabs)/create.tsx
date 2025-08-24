import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  TextInput,
  TouchableWithoutFeedback,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
import { uploadVideoToWorker, createVideoIframe } from "~/lib/upload/video-upload";
import { uploadImageToHive, createImageMarkdown } from "~/lib/upload/image-upload";
import { createHiveComment } from "~/lib/upload/post-utils";
import { SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG, getLastSnapsContainer } from "~/lib/hive-utils";
import { theme } from "~/lib/theme";

export default function CreatePost() {
  const { username, session } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSelectingMedia, setIsSelectingMedia] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasVideoInteraction, setHasVideoInteraction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const pickMedia = async () => {
    try {
      setIsSelectingMedia(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 0.75,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setMedia(asset.uri);
        setMediaType(asset.type === "video" ? "video" : "image");

        // Get the actual MIME type from the asset
        if (asset.mimeType) {
          setMediaMimeType(asset.mimeType);
        } else {
          // Fallback to detection based on file extension
          const fileExtension = asset.uri.split(".").pop()?.toLowerCase();
          if (asset.type === "image") {
            const imageMimeTypes: Record<string, string> = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              gif: "image/gif",
              webp: "image/webp",
              heic: "image/heic",
            };
            setMediaMimeType(
              imageMimeTypes[fileExtension || ""] || "image/jpeg"
            );
          } else {
            const videoMimeTypes: Record<string, string> = {
              mp4: "video/mp4",
              mov: "video/quicktime",
              avi: "video/x-msvideo",
              wmv: "video/x-ms-wmv",
              webm: "video/webm",
            };
            setMediaMimeType(
              videoMimeTypes[fileExtension || ""] || "video/mp4"
            );
          }
        }

        setIsVideoPlaying(false);
        setHasVideoInteraction(false);
      }
    } catch (error) {
      console.error("Error selecting media:", error);
      Alert.alert("Error", "Failed to select media. Please try again.");
    } finally {
      setIsSelectingMedia(false);
    }
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaType(null);
    setMediaMimeType(null);
    setIsVideoPlaying(false);
    setHasVideoInteraction(false);
  };

  const handleVideoPress = () => {
    if (!hasVideoInteraction) {
      setIsVideoPlaying(true);
      setHasVideoInteraction(true);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !media) {
      Alert.alert("Validation Error", "Please add some content or media to your post");
      return;
    }

    // Check if user is authenticated
    if (!username || username === "SPECTATOR" || !session?.decryptedKey) {
      Alert.alert("Authentication Required", "Please log in to create a post");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress("");

    try {
      let postBody = content;
      let imageUrls: string[] = [];
      let videoUrls: string[] = [];

      // Handle media upload
      if (media && mediaType && mediaMimeType) {
        const fileName = media.split("/").pop() || `${Date.now()}.${mediaType === "image" ? "jpg" : "mp4"}`;

        if (mediaType === "image") {
          setUploadProgress("Uploading image...");
          
          try {
            const imageResult = await uploadImageToHive(
              media,
              fileName,
              mediaMimeType,
              {
                username,
                privateKey: session.decryptedKey,
              }
            );
            
            imageUrls.push(imageResult.url);
            
            // Add image to post body
            const imageMarkdown = createImageMarkdown(imageResult.url, "Uploaded image");
            postBody += postBody ? `\n\n${imageMarkdown}` : imageMarkdown;
            
          } catch (imageError) {
            console.error("Image upload failed:", imageError);
            throw new Error("Failed to upload image. Please try again.");
          }
          
        } else if (mediaType === "video") {
          setUploadProgress("Uploading video to IPFS...");
          
          try {
            const videoResult = await uploadVideoToWorker(
              media,
              fileName,
              mediaMimeType,
              {
                creator: username,
              }
            );
            
            videoUrls.push(videoResult.cid);
            
            // Add video iframe to post body
            const videoIframe = createVideoIframe(videoResult.gatewayUrl, "Video");
            postBody += postBody ? `\n\n${videoIframe}` : videoIframe;
            
          } catch (videoError) {
            console.error("Video upload failed:", videoError);
            throw new Error("Failed to upload video. Please try again.");
          }
        }
      }

      setUploadProgress("Preparing post for blockchain...");

      // Get the latest snaps container for microblog posting
      let parentAuthor = "";
      let parentPermlink = COMMUNITY_TAG; // Default fallback
      
      try {
        setUploadProgress("Fetching snaps container...");
        const snapsContainer = await getLastSnapsContainer();
        parentAuthor = snapsContainer.author;
        parentPermlink = snapsContainer.permlink;
      } catch (error) {
        console.warn("Failed to get snaps container, using community fallback:", error);
        // Keep default values
      }

      // Prepare comment data for console logging
      const commentData = {
        body: postBody,
        parentAuthor,
        parentPermlink,
        username,
        images: imageUrls,
        videos: videoUrls,
        isSnapsPost: parentAuthor === SNAPS_CONTAINER_AUTHOR,
        metadata: {
          app: 'mycommunity-mobile',
          tags: [COMMUNITY_TAG, '...extracted hashtags'],
        }
      };

      // Post to blockchain
      await createHiveComment(
        postBody,
        parentAuthor, // Parent author for snaps container
        parentPermlink, // Parent permlink for snaps container
        {
          username,
          privateKey: session.decryptedKey,
          communityTag: COMMUNITY_TAG, // Include community tag in metadata
        }
      );

      // Success
      Alert.alert("Success", "Your post data is ready! Check console for details.");

      // Clear form
      setContent("");
      setMedia(null);
      setMediaType(null);
      setMediaMimeType(null);

      // Invalidate queries to refresh feed data
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userFeed", username] });

      // Navigate to feed
      router.push("/(tabs)/feed");
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
      console.error("Post error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <>
    { username === "SPECTATOR" ? (
      <ScrollView style={styles.container}>
        <CreateSpectatorInfo />
      </ScrollView>
    ) : (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container}>
          {/* Header */}
          <Text style={styles.headerText}>Create</Text>

          <View style={styles.card}>
            {/* Content Input */}
            <TextInput
              multiline
              placeholder="What's on your mind?"
              value={content}
              onChangeText={setContent}
              style={styles.textInput}
              placeholderTextColor={theme.colors.gray}
              numberOfLines={5}
            />
          </View>

          {/* Upload Progress */}
          {uploadProgress ? (
            <View style={styles.progressCard}>
              <Text style={styles.progressText}>{uploadProgress}</Text>
            </View>
          ) : null}

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <Pressable
              onPress={pickMedia}
              style={styles.mediaButton}
              disabled={isUploading || isSelectingMedia}
            >
              {isSelectingMedia ? (
                <>
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.text} />
                  </View>
                  <Text style={styles.buttonTextSecondary}>Selecting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color={theme.colors.gray} />
                  <Text style={styles.buttonTextSecondary}>
                    {media ? "Replace media" : "Add media"}
                  </Text>
                </>
              )}
            </Pressable>

            <Button
              onPress={handlePost}
              disabled={(!content.trim() && !media) || isUploading}
            >
              <Text style={styles.shareButtonText}>
                {isUploading ? "Publishing..." : "Share"}
              </Text>
            </Button>
          </View>

          {/* Media Preview */}
          {media && (
            <View style={styles.mediaPreviewContainer}>
              <View style={styles.mediaCard}>
                {mediaType === "image" ? (
                  <Image
                    source={{ uri: media }}
                    style={styles.mediaImage}
                  />
                ) : mediaType === "video" ? (
                  hasVideoInteraction ? (
                    <VideoPlayer url={media} playing={isVideoPlaying} />
                  ) : (
                    <Pressable style={styles.videoContainer} onPress={handleVideoPress}>
                      <VideoPlayer url={media} playing={false} />
                      <View style={styles.playButtonOverlay}>
                        <FontAwesome name="play-circle" size={50} color="white" />
                      </View>
                    </Pressable>
                  )
                ) : null}
                <Pressable
                  onPress={removeMedia}
                  style={styles.removeButton}
                  disabled={isUploading}
                >
                  <Ionicons name="close" size={20} color="white" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  headerText: {
    fontSize: theme.fontSizes.xxxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  textInput: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.default,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  progressCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  progressText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.gray,
    fontFamily: theme.fonts.default,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextSecondary: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.gray,
    fontFamily: theme.fonts.default,
  },
  shareButtonText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.black,
  },
  mediaPreviewContainer: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mediaCard: {
    position: 'relative',
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 1,
  },
  mediaImage: {
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: theme.spacing.xxs,
  },
  errorCard: {
    backgroundColor: '#330000',
    borderColor: '#cc0000',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: '#ff6666',
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.default,
  },
});
