import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
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
import { useIsFocused } from "@react-navigation/native";
import { VideoPlayer } from "~/components/Feed/VideoPlayer";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { RecentMediaGallery } from "~/components/ui/RecentMediaGallery";
import { useAuth } from "~/lib/auth-provider";
import { useToast } from "~/lib/toast-provider";
import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
import { canPost } from "~/lib/posting";
import { COMMUNITY_TAG } from "~/lib/hive-utils";
import { theme } from "~/lib/theme";
import * as SecureStore from "expo-secure-store";
import {
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
import { isJobActive } from "~/lib/upload/upload-job";
import { enqueue, UploadBusyError, useUploadJob } from "~/lib/upload/upload-store";

export default function CreatePost() {
  const { username, session } = useAuth();
  const { showToast } = useToast();
  // The job lives in the upload store; the screen only needs to know whether
  // Share is allowed. A failed job blocks too: there is no second slot.
  const uploadJob = useUploadJob();
  const jobBlocksShare = isJobActive(uploadJob) || uploadJob?.status === "failed";
  const shareHint = isJobActive(uploadJob)
    ? "Wait for the current upload to finish"
    : uploadJob?.status === "failed"
      ? "Retry or discard the failed upload first"
      : null;
  // Ref-based lock: a second tap during the ~1s media copy must not enqueue
  // twice, and state updates are too slow to prevent it.
  const submitLock = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [isSelectingMedia, setIsSelectingMedia] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasVideoInteraction, setHasVideoInteraction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Local file of the frame the author picked as the video's cover.
  const [coverUri, setCoverUri] = useState<string | null>(null);
  // Instagram caption, editable and separate from the Hive body. Only offered to
  // accounts that will actually cross-post, so the field never lies about where
  // the text ends up.
  const [igCaption, setIgCaption] = useState("");
  const [igCanCrossPost, setIgCanCrossPost] = useState(false);
  // Account-wide setting (Profile → gear → Instagram). Off means the composer
  // says nothing about Instagram at all: turning it off is a decision about
  // every post, so re-asking on each one would be nagging.
  const [igGlobalOn, setIgGlobalOn] = useState(true);
  // Per-post opt-out, only meaningful while the global setting is on.
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
    // New media starts a new post, so the per-post switch goes back to the
    // account-wide setting.
    isCrossPostEnabled().then((on) => {
      if (cancelled) return;
      setIgGlobalOn(on);
      setIgCrossPost(on);
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

  // The composer stays mounted while you flip the setting over on the profile
  // tab, and picking media isn't what brings you back — so re-read on focus.
  // Only a global "off" overrides the per-post switch here: someone who turned
  // it off for this post and stepped away shouldn't come back to it re-armed.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    isCrossPostEnabled().then((on) => {
      if (cancelled) return;
      setIgGlobalOn(on);
      if (!on) setIgCrossPost(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const handleVideoPress = () => {
    if (!hasVideoInteraction) {
      setIsVideoPlaying(true);
      setHasVideoInteraction(true);
    }
  };

  const handlePost = async () => {
    if (submitLock.current) return;

    if (!content.trim() && !media) {
      Alert.alert("Validation Error", "Please add some content or media to your post");
      return;
    }

    // Email (userbase) accounts are server-custody and have no local
    // decryptedKey, so gate on canPost() rather than the presence of a key.
    if (!username || username === "SPECTATOR" || !session || !canPost(session)) {
      Alert.alert("Authentication Required", "Please log in to create a post");
      return;
    }

    // The button is disabled in this state; this guards a stale press.
    if (jobBlocksShare) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const hasMedia = !!(media && mediaType && mediaMimeType);

      // Instagram decision, resolved here because the prompt is UI and the
      // runner has none. The parent-author check happens in the runner.
      let crossPost = false;
      if (hasMedia && igCrossPost) {
        try {
          crossPost =
            (await isCrossPostEnabled()) &&
            eligibleForCrosspost(session) &&
            (await getHivePower(username)) >= MIN_HP_TO_CROSSPOST;
        } catch {
          crossPost = false; // never block the post on cross-post setup
        }
      }
      if (crossPost) {
        try {
          const { source } = await getIgHandle(session);
          if (source === null) {
            const alreadyPrompted = await SecureStore.getItemAsync(IG_PROMPTED_KEY);
            if (!alreadyPrompted) {
              await SecureStore.setItemAsync(IG_PROMPTED_KEY, "1");
              await promptForIgHandle();
            }
          }
        } catch {
          // The handle is optional; the server builds a caption without it.
        }
      }

      await enqueue(
        {
          caption: content,
          mediaKind: hasMedia ? mediaType : null,
          mediaUri: hasMedia ? media : null,
          mime: hasMedia ? mediaMimeType : null,
          coverUri: mediaType === "video" ? coverUri : null,
          igCaption: igCaption.trim(),
          crossPostToInstagram: crossPost,
          communityTag: COMMUNITY_TAG,
        },
        session,
      );

      // Clear form
      setContent("");
      setMedia(null);
      setCoverUri(null);
      setIgCaption("");
      setMediaType(null);
      setMediaMimeType(null);

      // The pill takes it from here.
      router.push("/(tabs)/feed");
    } catch (error) {
      const errorMsg =
        error instanceof UploadBusyError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not start the upload";
      setErrorMessage(errorMsg);
      console.error("Enqueue error:", error);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
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

            {/* Action Bar */}
            <View style={styles.actionBar}>
              <Pressable
                onPress={pickMedia}
                style={styles.mediaButton}
                disabled={isSubmitting || isSelectingMedia}
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
                    disabled={isSubmitting}
                  >
                    <Ionicons name="close" size={20} color="white" />
                  </Pressable>
                </View>

                {mediaType === "video" && (
                  <VideoCoverPicker
                    videoUri={media}
                    onSelect={setCoverUri}
                    disabled={isSubmitting}
                  />
                )}

                {igCanCrossPost && igGlobalOn && (
                  <View style={styles.captionBlock}>
                    <View style={styles.captionHeader}>
                      {/* The switch controls the cross-post, not the caption.
                          Labelling this row "INSTAGRAM CAPTION" made it read as
                          a switch for the text field sitting under it. */}
                      <View style={styles.captionLabelGroup}>
                        <Ionicons
                          name="logo-instagram"
                          size={14}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.captionLabel}>
                          ALSO POST TO INSTAGRAM
                        </Text>
                      </View>
                      <Switch
                        value={igCrossPost}
                        onValueChange={setIgCrossPost}
                        disabled={isSubmitting}
                        trackColor={{
                          false: theme.colors.border,
                          true: theme.colors.primary,
                        }}
                        thumbColor={theme.colors.white}
                      />
                    </View>
                    {igCrossPost && (
                      <>
                        <Text style={styles.captionSubLabel}>Caption</Text>
                        <TextInput
                          style={styles.captionInput}
                          value={igCaption}
                          onChangeText={setIgCaption}
                          placeholder={content.trim() || "Same as your post"}
                          placeholderTextColor={theme.colors.muted}
                          multiline
                          maxLength={2200}
                          editable={!isSubmitting}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Publishing last, after the cover and caption the author may still
                be adjusting. Disabled while another job holds the single slot. */}
            <Button
              onPress={handlePost}
              disabled={(!content.trim() && !media) || isSubmitting || jobBlocksShare}
            >
              <Text style={styles.shareButtonText}>
                {isSubmitting ? "Sharing…" : "Share"}
              </Text>
            </Button>
            {shareHint ? <Text style={styles.shareHint}>{shareHint}</Text> : null}

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
  shareHint: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.default,
    textAlign: "center",
    marginTop: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
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
  captionLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  captionSubLabel: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.default,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xxs,
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
