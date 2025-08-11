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
} from "react-native";
import { router } from "expo-router";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { useColorScheme } from "~/lib/useColorScheme";
import { useAuth } from "~/lib/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
import { uploadVideoToPinata, createVideoIframe } from "~/lib/upload/video-upload";
import { uploadImageToHive, createImageMarkdown } from "~/lib/upload/image-upload";
import { createHiveComment } from "~/lib/upload/post-utils";
import { SNAPS_CONTAINER_AUTHOR, COMMUNITY_TAG, getLastSnapsContainer } from "~/lib/hive-utils";

export default function CreatePost() {
  const { isDarkColorScheme } = useColorScheme();
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
            const videoResult = await uploadVideoToPinata(
              media,
              fileName,
              mediaMimeType,
              {
                creator: username,
              }
            );
            
            videoUrls.push(videoResult.IpfsHash);
            
            // Add video iframe to post body
            const videoIframe = createVideoIframe(videoResult.IpfsHash, "Video");
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
        console.log("📦 Using snaps container:", { parentAuthor, parentPermlink });
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

      console.log("📝 Post data prepared for blockchain:", commentData);

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
      queryClient.invalidateQueries({ queryKey: ["trending"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
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
      <ScrollView className="flex-1 p-4 bg-background">
        <CreateSpectatorInfo />
      </ScrollView>
    ) : (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 bg-background">
          {/* Header */}
          <Text className="text-3xl font-bold ml-4 mt-4">Create</Text>

          <Card className="m-4 mt-2 p-4 bg-card border border-border rounded-lg">
            {/* Content Input */}
            <TextInput
              multiline
              placeholder="What's on your mind?"
              value={content}
              onChangeText={setContent}
              className="text-foreground text-lg min-h-[20vh]"
              placeholderTextColor="#666"
              style={{ textAlignVertical: "top" }}
              numberOfLines={5}
            />
          </Card>

          {/* Upload Progress */}
          {uploadProgress ? (
            <Card className="mx-4 mb-2 p-3 bg-card border border-border rounded-lg">
              <Text className="text-sm text-foreground/70">{uploadProgress}</Text>
            </Card>
          ) : null}

          {/* Action Bar */}
          <View className="flex-row items-center justify-between p-4 border-t border-border">
            <Pressable
              onPress={pickMedia}
              className="flex-row items-center"
              disabled={isUploading || isSelectingMedia}
            >
              {isSelectingMedia ? (
                <>
                  <View className="w-6 h-6 items-center justify-center">
                    <ActivityIndicator size="small" />
                  </View>
                  <Text className="ml-2 text-foreground/60">Selecting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color="#666" />
                  <Text className="ml-2 text-foreground/60">
                    {media ? "Replace media" : "Add media"}
                  </Text>
                </>
              )}
            </Pressable>

            <Button
              onPress={handlePost}
              disabled={(!content.trim() && !media) || isUploading}
            >
              <Text className="font-medium">
                {isUploading ? "Publishing..." : "Share"}
              </Text>
            </Button>
          </View>

          {/* Media Preview */}
          {media && (
            <View className="mx-4 mb-4">
              <Card className="relative border border-muted rounded-lg overflow-hidden w-full aspect-square">
                {mediaType === "image" ? (
                  <Image
                    source={{ uri: media }}
                    style={{ resizeMode: "cover", width: "100%", height: "100%" }}
                  />
                ) : mediaType === "video" ? (
                  hasVideoInteraction ? (
                    <VideoPlayer url={media} playing={isVideoPlaying} />
                  ) : (
                    <Pressable className="w-full h-full" onPress={handleVideoPress}>
                      <VideoPlayer url={media} playing={false} />
                      <View className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <FontAwesome name="play-circle" size={50} color="white" />
                      </View>
                    </Pressable>
                  )
                ) : null}
                <Pressable
                  onPress={removeMedia}
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                  disabled={isUploading}
                >
                  <Ionicons name="close" size={20} color="white" />
                </Pressable>
              </Card>
            </View>
          )}

          {/* Error Message */}
          {errorMessage && (
            <Card className="mx-4 mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
              <Text className="text-red-800 text-sm">{errorMessage}</Text>
            </Card>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    )}
    </>
  );
}
