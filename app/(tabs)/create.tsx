import { Ionicons } from "@expo/vector-icons";
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
  BackHandler,
  StyleSheet,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { RecentMediaGallery } from "~/components/ui/RecentMediaGallery";
import { useAuth } from "~/lib/auth-provider";
import { useToast } from "~/lib/toast-provider";
import { CreateSpectatorInfo } from "~/components/SpectatorMode/CreateSpectatorInfo";
import { canPost } from "~/lib/posting";
import { COMMUNITY_TAG } from "~/lib/hive-utils";
import { theme } from "~/lib/theme";
import { t } from "~/lib/i18n";
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
    ? t("create.upload.busy")
    : uploadJob?.status === "failed"
      ? t("create.upload.failed_blocking")
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
  // One screen, three steps: pick the media, edit it (videos only), then write
  // the caption and share. Steps instead of routes keep the whole draft in this
  // component, so going back never loses what was already chosen.
  const [step, setStep] = useState<Step>("pick");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Local file of the frame the author picked as the video's cover.
  const [coverUri, setCoverUri] = useState<string | null>(null);
  // A cover file still being written: Next waits, or the post would carry the old one.
  const [coverPending, setCoverPending] = useState(false);
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
      showToast(t("create.ig.handle_saved"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("create.ig.handle_save_failed"), "error");
    } finally {
      setIgModalSaving(false);
      closeIgModal();
    }
  };

  // A video goes on to the edit step (cover); a photo has nothing to edit yet.
  const selectMedia = (uri: string, kind: "image" | "video", mime?: string | null) => {
    setMedia(uri);
    setMediaType(kind);
    setMediaMimeType(mime || guessMime(uri, kind));
    // The same file keeps its cover: the picker is keyed by the file, so it is
    // not remounted and would never emit the cover again.
    if (uri !== media) setCoverUri(null);
    setStep(kind === "video" ? "edit" : "details");
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
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (asset) {
        selectMedia(asset.uri, asset.type === "video" ? "video" : "image", asset.mimeType);
      }
    } catch (error) {
      console.error("Error selecting media:", error);
      Alert.alert(t("create.alert.error_title"), t("create.alert.select_media_failed"));
    } finally {
      setIsSelectingMedia(false);
    }
  };

  const handleGalleryMediaSelect = (asset: { uri: string; mediaType: "photo" | "video" }) => {
    selectMedia(asset.uri, asset.mediaType === "video" ? "video" : "image");
  };

  // A post without media skips straight to the caption.
  const startTextOnly = () => {
    setMedia(null);
    setMediaType(null);
    setMediaMimeType(null);
    setCoverUri(null);
    setStep("details");
  };

  const goBack = () => {
    if (step === "details" && mediaType === "video") setStep("edit");
    else setStep("pick");
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

  const handlePost = async () => {
    if (submitLock.current) return;

    if (!content.trim() && !media) {
      Alert.alert(t("create.alert.validation_title"), t("create.alert.validation_message"));
      return;
    }

    // Email (userbase) accounts are server-custody and have no local
    // decryptedKey, so gate on canPost() rather than the presence of a key.
    if (!username || username === "SPECTATOR" || !session || !canPost(session)) {
      Alert.alert(t("create.alert.auth_title"), t("create.alert.auth_message"));
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
      setStep("pick");

      // The pill takes it from here.
      router.push("/(tabs)/feed");
    } catch (error) {
      const errorMsg =
        error instanceof UploadBusyError
          ? error.message
          : error instanceof Error
            ? error.message
            : t("create.error.start_failed");
      setErrorMessage(errorMsg);
      console.error("Enqueue error:", error);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  // Android's back button walks the steps before it leaves the tab.
  useEffect(() => {
    if (!isFocused || step === "pick") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Swallowed while sharing, like the disabled back arrow: an error must
      // land on the details step the author is still looking at.
      if (!isSubmitting) goBack();
      return true;
    });
    return () => sub.remove();
    // goBack only reads step and mediaType.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, step, mediaType, isSubmitting]);

  const topBar = (onNext?: () => void, nextDisabled = false) => (
    <View style={styles.topBar}>
      <Pressable
        onPress={goBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("create.step.back_a11y")}
        disabled={isSubmitting}
      >
        <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
      </Pressable>
      {onNext ? (
        <Pressable
          onPress={onNext}
          hitSlop={12}
          accessibilityRole="button"
          disabled={nextDisabled}
          accessibilityState={{ disabled: nextDisabled }}
        >
          <Text style={[styles.nextText, nextDisabled && styles.nextDisabled]}>
            {t("create.step.next")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (username === "SPECTATOR") {
    return (
      <ScrollView style={styles.container}>
        <CreateSpectatorInfo />
      </ScrollView>
    );
  }

  return (
    <>
      {/* Hidden rather than unmounted, so coming back does not reload the
          gallery or lose its scroll position. */}
      <ScrollView style={[styles.container, step !== "pick" && styles.hidden]}>
        <Text style={styles.headerText}>{t("create.header.title")}</Text>
        <View style={styles.pickActions}>
          <Pressable
            onPress={pickMedia}
            style={styles.pickButton}
            disabled={isSelectingMedia}
          >
            {isSelectingMedia ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <Ionicons name="images-outline" size={22} color={theme.colors.text} />
            )}
            <Text style={styles.pickButtonText}>
              {isSelectingMedia ? t("create.media.selecting") : t("create.media.add")}
            </Text>
          </Pressable>
          <Pressable onPress={startTextOnly} style={styles.pickButton}>
            <Ionicons name="create-outline" size={22} color={theme.colors.text} />
            <Text style={styles.pickButtonText}>{t("create.step.text_only")}</Text>
          </Pressable>
        </View>
        <RecentMediaGallery onMediaSelect={handleGalleryMediaSelect} maxItems={30} />
      </ScrollView>

      {/* Hidden rather than unmounted outside its step: the cover picker holds
          the cursor position, and remounting it would re-extract the default
          frame over the one the author chose. Keyed by the file so a new video
          starts fresh. */}
      {media && mediaType === "video" && (
        // Not scrollable: the video shrinks to fit so the cover strip stays
        // above the upload pill, which floats over the screen.
        <View
          key={media}
          style={[
            styles.container,
            styles.editStep,
            uploadJob && styles.pillClearance,
            step !== "edit" && styles.hidden,
          ]}
        >
          {topBar(() => setStep("details"), coverPending)}
          <VideoCoverPicker
            videoUri={media}
            onSelect={setCoverUri}
            onPendingChange={setCoverPending}
            disabled={isSubmitting}
          />
        </View>
      )}

      {step === "details" && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            {topBar()}
            <View style={styles.detailsRow}>
              <TextInput
                multiline
                placeholder={t("create.input.placeholder")}
                value={content}
                onChangeText={setContent}
                style={styles.textInput}
                placeholderTextColor={theme.colors.gray}
                editable={!isSubmitting}
              />
              {media ? (
                <Pressable
                  style={styles.thumb}
                  onPress={mediaType === "video" ? () => setStep("edit") : undefined}
                  disabled={mediaType !== "video" || isSubmitting}
                  accessibilityRole={mediaType === "video" ? "button" : undefined}
                >
                  {mediaType === "image" ? (
                    <Image source={{ uri: media }} style={styles.thumbImage} />
                  ) : coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons name="videocam-outline" size={28} color={theme.colors.gray} />
                  )}
                  {mediaType === "video" ? (
                    <View style={styles.thumbLabel}>
                      <Text style={styles.thumbLabelText}>{t("create.cover.edit")}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}
            </View>

            {media && igCanCrossPost && igGlobalOn && (
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
                      {t("create.ig.toggle_label")}
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
                <Text style={styles.captionSubLabel}>
                  {t("create.ig.toggle_hint")}
                </Text>
                {igCrossPost && (
                  <>
                    <Text style={styles.captionSubLabel}>{t("create.ig.caption_label")}</Text>
                    <TextInput
                      style={styles.captionInput}
                      value={igCaption}
                      onChangeText={setIgCaption}
                      placeholder={content.trim() || t("create.ig.caption_placeholder")}
                      placeholderTextColor={theme.colors.muted}
                      multiline
                      maxLength={2200}
                      editable={!isSubmitting}
                    />
                  </>
                )}
              </View>
            )}

            {/* Disabled while another job holds the single upload slot. */}
            <View style={styles.shareBlock}>
              <Button
                onPress={handlePost}
                disabled={(!content.trim() && !media) || isSubmitting || jobBlocksShare}
              >
                <Text style={styles.shareButtonText}>
                  {isSubmitting ? t("create.share.button_busy") : t("create.share.button")}
                </Text>
              </Button>
              {shareHint ? <Text style={styles.shareHint}>{shareHint}</Text> : null}
            </View>

            {errorMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
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

type Step = "pick" | "edit" | "details";

const THUMB_SIZE = 112;
// ponytail: approximate height of UploadPill collapsed plus its gap; export it
// from UploadPill if its layout changes.
const UPLOAD_PILL_SPACE = 72;

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
};
const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  webm: "video/webm",
};

// Fallback by file extension, for pickers that report no MIME type.
function guessMime(uri: string, kind: "image" | "video"): string {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  return kind === "image" ? IMAGE_MIME[ext] ?? "image/jpeg" : VIDEO_MIME[ext] ?? "video/mp4";
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  nextText: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  // While the cover file is still being written.
  nextDisabled: {
    opacity: 0.4,
  },
  // The tab bar's raised + button sticks up into the screen; this keeps the
  // cover strip clear of it.
  editStep: {
    paddingBottom: theme.spacing.xl,
  },
  pillClearance: {
    paddingBottom: UPLOAD_PILL_SPACE,
  },
  pickActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
  },
  pickButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  pickButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
  },
  hidden: {
    display: "none",
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.default,
    minHeight: THUMB_SIZE,
    textAlignVertical: "top",
  },
  // Square like the profile-grid tile, so the author sees the grid's crop.
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.secondaryCard,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: theme.spacing.xxs,
    backgroundColor: theme.colors.scrim,
    alignItems: "center",
  },
  thumbLabelText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
  },
  shareBlock: {
    marginTop: theme.spacing.lg,
  },
  shareHint: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.default,
    textAlign: "center",
    marginTop: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
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
