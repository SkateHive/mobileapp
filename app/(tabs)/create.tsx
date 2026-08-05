import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
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
  Switch,
} from "react-native";
import { router } from "expo-router";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { RecentMediaGallery } from "~/components/ui/RecentMediaGallery";
import { useAuth } from "~/lib/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/lib/toast-provider";
import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
import {
  uploadVideoToWorker,
  createVideoIframe,
} from "~/lib/upload/video-upload";
import {
  uploadImageToHive,
  uploadImageViaUserbase,
  createImageMarkdown,
} from "~/lib/upload/image-upload";
import { canPost, isUserbaseSession, postComment } from "~/lib/posting";
import {
  SNAPS_CONTAINER_AUTHOR,
  COMMUNITY_TAG,
  getLastSnapsContainer,
} from "~/lib/hive-utils";
import { theme } from "~/lib/theme";
import * as SecureStore from "expo-secure-store";
import {
  crossPostToInstagram,
  getIgHandle,
  setIgHandle,
  getHivePower,
  eligibleForCrosspost,
  hasEligibleHiveAccount,
  MIN_HP_TO_CROSSPOST,
  isCrossPostEnabled,
} from "~/lib/instagram";
import { InstagramHandleModal } from "~/components/Instagram/InstagramHandleModal";
import { VideoCoverPicker } from "~/components/create/VideoCoverPicker";
import { WEB_BASE_URL } from "~/lib/constants";

export default function CreatePost() {
  const { username, session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoStage, setVideoStage] = useState<string>("");
  // Local file of the frame the author picked as the video's cover.
  const [coverUri, setCoverUri] = useState<string | null>(null);
  // Instagram caption, editable and separate from the Hive body. Only offered to
  // accounts that will actually cross-post, so the field never lies about where
  // the text ends up.
  const [igCaption, setIgCaption] = useState("");
  const [igCanCrossPost, setIgCanCrossPost] = useState(false);
  // Per-post override of the account-wide setting (Profile → gear → Instagram).
  // Starts from that setting and resets to it after each post.
  const [igCrossPost, setIgCrossPost] = useState(true);

  // Instagram first-time handle prompt (eligible classic-key accounts only)
  const [igModalVisible, setIgModalVisible] = useState(false);
  const [igModalSaving, setIgModalSaving] = useState(false);
  const igPromptResolve = React.useRef<(() => void) | null>(null);

  const IG_PROMPTED_KEY = "ig_handle_prompted";

  // Resolve when the user finishes (saves or skips) the IG handle prompt.
  const promptForIgHandle = () =>
    new Promise<void>((resolve) => {
      igPromptResolve.current = resolve;
      setIgModalVisible(true);
    });

  const closeIgModal = () => {
    setIgModalVisible(false);
    igPromptResolve.current?.();
    igPromptResolve.current = null;
  };

  const saveIgHandle = async (handle: string) => {
    if (!session) return closeIgModal();
    try {
      setIgModalSaving(true);
      await setIgHandle(handle, session);
      showToast("Instagram handle saved", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save handle", "error");
    } finally {
      setIgModalSaving(false);
      closeIgModal();
    }
  };

  // Fire-and-forget cross-post to @skatehive on Instagram for eligible posts:
  // classic Hive-key account, >=100 HP, posting to the main snaps feed, with
  // media. The server re-checks HP/limits authoritatively; this only avoids a
  // doomed request and drives the first-time handle prompt.
  const maybeCrossPostToInstagram = async (args: {
    author: string;
    permlink: string;
    parentAuthor: string;
    body: string;
    tags: string[];
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
  }) => {
    try {
      if (!igCrossPost) return; // author turned it off (globally or for this post)
      if (!session || !eligibleForCrosspost(session)) return; // classic-key only
      if (args.parentAuthor !== SNAPS_CONTAINER_AUTHOR) return; // main feed only
      if (!args.imageUrl && !args.videoUrl) return; // needs media
      if ((await getHivePower(args.author)) < MIN_HP_TO_CROSSPOST) return;

      // First-time prompt: if no handle is stored and we haven't asked before.
      const { source } = await getIgHandle(session);
      if (source === null) {
        const alreadyPrompted = await SecureStore.getItemAsync(IG_PROMPTED_KEY);
        if (!alreadyPrompted) {
          await SecureStore.setItemAsync(IG_PROMPTED_KEY, "1");
          await promptForIgHandle();
        }
      }

      // Best-effort, fire-and-forget. The snap already posted successfully, so
      // we only celebrate a CONFIRMED Instagram publish and stay quiet
      // otherwise: a Reel can take longer than this request waits (it may still
      // publish server-side after we'd have timed out), so a failure/timeout
      // here is NOT a reliable signal and must never show the user a red error.
      crossPostToInstagram(session, {
        permlink: args.permlink,
        body: args.body,
        tags: args.tags,
        imageUrl: args.imageUrl,
        videoUrl: args.videoUrl,
        caption: args.caption,
        permalinkUrl: `${WEB_BASE_URL}/post/${args.author}/${args.permlink}`,
      })
        .then(() => showToast("Shared to Instagram", "success"))
        .catch((e) => {
          console.warn(
            "[instagram] cross-post unconfirmed:",
            e instanceof Error ? e.message : e
          );
        });
    } catch {
      // Never block the post flow on cross-post setup.
    }
  };


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
        setCoverUri(null);

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

  const handleGalleryMediaSelect = async (mediaAsset: any) => {
    try {
      setMedia(mediaAsset.uri);
      setMediaType(mediaAsset.mediaType === "video" ? "video" : "image");
      setCoverUri(null);

      // Get the actual MIME type based on the asset type
      const fileExtension = mediaAsset.uri.split(".").pop()?.toLowerCase();
      if (mediaAsset.mediaType === "photo") {
        const imageMimeTypes: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          heic: "image/heic",
        };
        setMediaMimeType(imageMimeTypes[fileExtension || ""] || "image/jpeg");
      } else if (mediaAsset.mediaType === "video") {
        const videoMimeTypes: Record<string, string> = {
          mp4: "video/mp4",
          mov: "video/quicktime",
          avi: "video/x-msvideo",
          wmv: "video/x-ms-wmv",
          webm: "video/webm",
        };
        setMediaMimeType(videoMimeTypes[fileExtension || ""] || "video/mp4");
      }

      setIsVideoPlaying(false);
      setHasVideoInteraction(false);
    } catch (error) {
      console.error("Error selecting media from gallery:", error);
      Alert.alert(
        "Error",
        "Failed to select media from gallery. Please try again."
      );
    }
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaType(null);
    setMediaMimeType(null);
    setIsVideoPlaying(false);
    setHasVideoInteraction(false);
    setCoverUri(null);
  };

  // Resolve cross-post eligibility as soon as there's media, so the caption field
  // only appears for accounts whose text will actually reach Instagram. The server
  // re-checks authoritatively; this only drives the UI.
  useEffect(() => {
    let cancelled = false;
    if (!media || !session || !eligibleForCrosspost(session)) {
      setIgCanCrossPost(false);
      return;
    }
    // Re-read here rather than on mount: the composer stays mounted while the
    // user flips the account-wide setting over on the profile tab.
    isCrossPostEnabled().then((on) => {
      if (!cancelled) setIgCrossPost(on);
    });
    hasEligibleHiveAccount(session)
      .then((ok) => {
        if (!cancelled) setIgCanCrossPost(ok);
      })
      .catch(() => {
        if (!cancelled) setIgCanCrossPost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [media, session]);

  const handleVideoPress = () => {
    if (!hasVideoInteraction) {
      setIsVideoPlaying(true);
      setHasVideoInteraction(true);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !media) {
      Alert.alert(
        "Validation Error",
        "Please add some content or media to your post"
      );
      return;
    }

    // Check if user is authenticated. Email (userbase) accounts are
    // server-custody and have no local decryptedKey, so gate on canPost()
    // rather than the presence of a local key.
    if (!username || username === "SPECTATOR" || !session || !canPost(session)) {
      Alert.alert("Authentication Required", "Please log in to create a post");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress("");
    setVideoProgress(0);
    setVideoStage("");

    try {
      let postBody = content;
      // Uploaded photos plus any video poster frame — becomes json_metadata.images.
      let imageUrls: string[] = [];
      // Public media URLs for an optional Instagram cross-post.
      let igImageUrl: string | undefined;
      let igVideoUrl: string | undefined;

      // Handle media upload
      if (media && mediaType && mediaMimeType) {
        const fileName =
          media.split("/").pop() ||
          `${Date.now()}.${mediaType === "image" ? "jpg" : "mp4"}`;

        if (mediaType === "image") {
          setUploadProgress("Uploading image...");

          try {
            // Email (userbase) accounts have no local key to sign the Hive
            // image challenge, so the server signs + uploads on their behalf.
            const imageResult = isUserbaseSession(session)
              ? await uploadImageViaUserbase(
                  media,
                  fileName,
                  mediaMimeType,
                  session.userbaseToken!
                )
              : await uploadImageToHive(media, fileName, mediaMimeType, {
                  username,
                  privateKey: session.decryptedKey,
                });

            imageUrls.push(imageResult.url);
            igImageUrl = imageResult.url;

            // Add image to post body
            const imageMarkdown = createImageMarkdown(
              imageResult.url,
              "Uploaded image"
            );
            postBody += postBody ? `\n\n${imageMarkdown}` : imageMarkdown;
          } catch (imageError) {
            console.error("Image upload failed:", imageError);
            throw new Error("Failed to upload image. Please try again.");
          }
        } else if (mediaType === "video") {
          setUploadProgress("Uploading video...");
          setVideoProgress(0);
          setVideoStage('receiving');

          try {
            // Upload the author's chosen frame first: the worker prefers a
            // supplied cover over extracting its own, so the choice sticks and
            // the server skips an ffmpeg pass. Best-effort — if it fails we fall
            // back to the frame the worker picks.
            let coverUrl: string | undefined;
            if (coverUri) {
              setUploadProgress("Uploading cover...");
              try {
                const cover = isUserbaseSession(session)
                  ? await uploadImageViaUserbase(
                      coverUri,
                      "cover.jpg",
                      "image/jpeg",
                      session.userbaseToken!
                    )
                  : await uploadImageToHive(coverUri, "cover.jpg", "image/jpeg", {
                      username,
                      privateKey: session.decryptedKey,
                    });
                coverUrl = cover.url;
              } catch (coverError) {
                console.warn("Cover upload failed, using the worker's frame:", coverError);
              }
              setUploadProgress("Uploading video...");
            }

            const videoResult = await uploadVideoToWorker(
              media,
              fileName,
              mediaMimeType,
              {
                creator: username,
                thumbnailUrl: coverUrl,
                onProgress: (progress, stage) => {
                  setVideoProgress(progress);
                  setVideoStage(stage);
                  const stageLabels: Record<string, string> = {
                    receiving: 'Sending to server...',
                    transcoding: 'Transcoding video...',
                    optimized: 'Video already optimized!',
                    uploading: 'Uploading to IPFS...',
                    complete: 'Done!',
                    error: 'Error',
                  };
                  setUploadProgress(stageLabels[stage] || `Processing... ${progress}%`);
                },
              }
            );

            igVideoUrl = videoResult.gatewayUrl;

            // The poster is what the profile grid renders before the ~5MB clip
            // downloads, and what Instagram uses as the Reel cover. The author's
            // frame wins; the worker's own extraction is the fallback.
            const poster = coverUrl ?? videoResult.thumbnailUrl;
            if (poster) {
              imageUrls.push(poster);
              igImageUrl = poster;
            }

            // Add video iframe to post body
            const videoIframe = createVideoIframe(
              videoResult.gatewayUrl,
              "Video"
            );
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
        console.warn(
          "Failed to get snaps container, using community fallback:",
          error
        );
        // Keep default values
      }

      // Build tags + metadata (community tag plus any hashtags in the body).
      const bodyHashtags = (postBody.match(/#(\w+)/g) || []).map((h) =>
        h.slice(1)
      );
      const tags = [COMMUNITY_TAG, ...bodyHashtags].filter(
        (tag, index, array) => array.indexOf(tag) === index
      );
      const permlink = `sh-${new Date()
        .toISOString()
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .substring(0, 15)}`;

      // Post to blockchain via the unified seam: userbase (email) accounts are
      // signed server-side via bearer token; classic key accounts sign locally.
      await postComment(session, {
        parentAuthor,
        parentPermlink,
        body: postBody,
        permlink,
        jsonMetadata: {
          app: "mycommunity-mobile",
          tags,
          ...(imageUrls.length > 0 && { images: imageUrls }),
        },
      });

      // Success
      showToast("Posted Successfully", "success");

      // Optional Instagram cross-post (eligible classic-key accounts). Does its
      // own eligibility checks; publish runs in the background. May show the
      // first-time handle prompt before navigating away.
      await maybeCrossPostToInstagram({
        author: username,
        permlink,
        parentAuthor,
        body: postBody,
        tags,
        imageUrl: igImageUrl,
        videoUrl: igVideoUrl,
        caption: igCaption.trim() || undefined,
      });

      // Clear form
      setContent("");
      setMedia(null);
      setCoverUri(null);
      setIgCaption("");
      setMediaType(null);
      setMediaMimeType(null);

      // Invalidate queries to refresh feed data
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userFeed", username] });

      // Navigate to feed
      router.push("/(tabs)/feed");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "An unknown error occurred";
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
      {username === "SPECTATOR" ? (
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
                {mediaType === 'video' && videoProgress > 0 && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(videoProgress, 100)}%` }]} />
                    <Text style={styles.progressPercent}>{videoProgress}%</Text>
                  </View>
                )}
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
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.text}
                      />
                    </View>
                    <Text style={styles.buttonTextSecondary}>Selecting...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="image-outline"
                      size={24}
                      color={theme.colors.gray}
                    />
                    <Text style={styles.buttonTextSecondary}>
                      {media ? "Replace media" : "Add media"}
                    </Text>
                  </>
                )}
              </Pressable>

            </View>

            {/* Media Preview */}
            {media && (
              <View style={styles.mediaPreviewContainer}>
                <View style={styles.mediaCard}>
                  {mediaType === "image" ? (
                    <Image source={{ uri: media }} style={styles.mediaImage} />
                  ) : mediaType === "video" ? (
                    hasVideoInteraction ? (
                      <VideoPlayer url={media} playing={isVideoPlaying} />
                    ) : (
                      <Pressable
                        style={styles.videoContainer}
                        onPress={handleVideoPress}
                      >
                        <VideoPlayer url={media} playing={false} />
                        <View style={styles.playButtonOverlay}>
                          <FontAwesome
                            name="play-circle"
                            size={50}
                            color="white"
                          />
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

                {mediaType === "video" && (
                  <VideoCoverPicker
                    videoUri={media}
                    onSelect={setCoverUri}
                    disabled={isUploading}
                  />
                )}

                {igCanCrossPost && (
                  <View style={styles.captionBlock}>
                    <View style={styles.captionHeader}>
                      <Text style={styles.captionLabel}>
                        {igCrossPost ? "INSTAGRAM CAPTION" : "INSTAGRAM: OFF FOR THIS POST"}
                      </Text>
                      <Switch
                        value={igCrossPost}
                        onValueChange={setIgCrossPost}
                        disabled={isUploading}
                        trackColor={{
                          false: theme.colors.border,
                          true: theme.colors.primary,
                        }}
                        thumbColor={theme.colors.text}
                      />
                    </View>
                    {igCrossPost && (
                      <TextInput
                        style={styles.captionInput}
                        value={igCaption}
                        onChangeText={setIgCaption}
                        placeholder={content.trim() || "Same as your post"}
                        placeholderTextColor={theme.colors.muted}
                        multiline
                        maxLength={2200}
                        editable={!isUploading}
                      />
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Publishing last, after the cover and caption the author may still
                be adjusting. */}
            <Button
              onPress={handlePost}
              disabled={(!content.trim() && !media) || isUploading}
            >
              <Text style={styles.shareButtonText}>
                {isUploading ? "Publishing..." : "Share"}
              </Text>
            </Button>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Recent Media Gallery */}
            <RecentMediaGallery onMediaSelect={handleGalleryMediaSelect} />
          </ScrollView>
        </TouchableWithoutFeedback>
      )}

      <InstagramHandleModal
        visible={igModalVisible}
        saving={igModalSaving}
        onSave={saveIgHandle}
        onClose={closeIgModal}
      />
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
    // Snaps are short, and the cover strip plus caption now share the screen —
    // the box grows with the text anyway.
    minHeight: 96,
    textAlignVertical: "top",
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
  progressBarContainer: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    marginTop: theme.spacing.xs,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  progressBarFill: {
    height: '100%' as any,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressPercent: {
    position: 'absolute' as const,
    right: 0,
    top: -16,
    fontSize: 10,
    color: theme.colors.primary,
    fontFamily: theme.fonts.default,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
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
  captionBlock: {
    marginTop: theme.spacing.md,
  },
  captionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  captionLabel: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xxs,
  },
  captionInput: {
    minHeight: 64,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    textAlignVertical: 'top',
  },
  mediaPreviewContainer: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mediaCard: {
    position: "relative",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    width: "100%",
    aspectRatio: 1,
  },
  mediaImage: {
    resizeMode: "cover",
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    width: "100%",
    height: "100%",
  },
  playButtonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  removeButton: {
    position: "absolute",
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: theme.spacing.xxs,
  },
  errorCard: {
    backgroundColor: "#330000",
    borderColor: "#cc0000",
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: "#ff6666",
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.default,
  },
});
