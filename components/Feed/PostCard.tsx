import React, { useCallback, useState, useEffect, useMemo } from "react";
import { HIVE_AVATAR_URL } from "~/lib/constants";
import { useSoftPostOverlay } from "~/lib/userbase/soft-post-context";
import { FontAwesome } from "@expo/vector-icons";
import { ArrowUp, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { canPost, castVote, submitReport } from "~/lib/posting";
import { useAuth } from "~/lib/auth-provider";
import { useVoteValue } from "~/lib/hooks/useVoteValue";
import { useViewportTracker } from "~/lib/ViewportTracker";
import { Text } from "../ui/text";
import { VotingSlider } from "../ui/VotingSlider";
import { MediaPreview } from "./MediaPreview";
import { EnhancedMarkdownRenderer } from "../markdown/EnhancedMarkdownRenderer";
import { SpotLocationLine } from "../spotmap/SpotLocationLine";
import { parseSpotBody } from "~/lib/spotmap/parseSpotBody";
// Lazy import breaks the require cycle:
// PostCard → FullConversationDrawer → PostCard
const FullConversationDrawer = React.lazy(() =>
  import("./FullConversationDrawer").then((m) => ({
    default: m.FullConversationDrawer,
  })),
);
import { useToast } from "~/lib/toast-provider";
import { theme } from "~/lib/theme";
import type { Media, NestedDiscussion } from "../../lib/types";
import type { Discussion } from "@hiveio/dhive";
import { extractMediaFromBody, removeVideoLinksFromBody } from "~/lib/utils";

// Action-bar icons (upvote / comment) — sized to match the web footer.
const ACTION_ICON_SIZE = 18;

// Helper function to format time in abbreviated format (2 characters max)
const formatTimeAbbreviated = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "1m"; // Less than a minute, show 1m

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo`;

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y`;
};

interface PostCardProps {
  post: Discussion | NestedDiscussion;
  currentUsername: string | null;
  onOpenFullConversation?: (post: Discussion | NestedDiscussion) => void;
}

export const PostCard = React.memo(
  ({ post, currentUsername, onOpenFullConversation }: PostCardProps) => {
    // Mask the shared @skateuser account with the real (email/lite) author.
    const softOverlay = useSoftPostOverlay(post.author, post.permlink);
    const displayAuthor = softOverlay?.handle || post.author;
    const displayAvatar = softOverlay?.avatar_url || `${HIVE_AVATAR_URL}/${displayAuthor}/avatar/small`;
    const { session, followingList, updateUserRelationship } = useAuth();
    const { estimateVoteValue, isLoading: isVoteValueLoading } =
      useVoteValue(currentUsername);
    const { isItemVisible, registerItem, unregisterItem } =
      useViewportTracker();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
    const [isVoting, setIsVoting] = useState(false);
    const [showSlider, setShowSlider] = useState(false);
    const [voteWeight, setVoteWeight] = useState(100);
    const [isLiked, setIsLiked] = useState(false);
    // Only use local drawer state when parent doesn't provide a callback
    const [isFullConversationVisible, setIsFullConversationVisible] =
      useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedReportReason, setSelectedReportReason] = useState("");
    const [reportAdditionalInfo, setReportAdditionalInfo] = useState("");
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);

    // Register/unregister with viewport tracker
    useEffect(() => {
      registerItem(post.permlink);
      return () => unregisterItem(post.permlink);
    }, [post.permlink, registerItem, unregisterItem]);

    // Check if this post is currently visible
    const isVisible = isItemVisible(post.permlink);

    // Only computed once on mount (useState ignores the initializer on subsequent renders)
    const [voteCount, setVoteCount] = useState(() =>
      Array.isArray(post.active_votes)
        ? post.active_votes.filter((vote: any) => vote.weight > 0).length
        : 0,
    );

    // Sync voteCount when post.active_votes changes externally (e.g., data refresh)
    useEffect(() => {
      if (Array.isArray(post.active_votes)) {
        setVoteCount(
          post.active_votes.filter((vote: any) => vote.weight > 0).length,
        );
      }
    }, [post.active_votes]);

    // Track the post's payout value for dynamic updates
    const [payoutValue, setPayoutValue] = useState(() => {
      const pending = parseFloat(
        post.pending_payout_value?.toString?.() || "0",
      );
      const total = parseFloat(post.total_payout_value?.toString?.() || "0");
      const curator = parseFloat(
        post.curator_payout_value?.toString?.() || "0",
      );
      return pending + total + curator;
    });
    const { showToast } = useToast();

    // Memoize media extraction
    const media = useMemo(() => extractMediaFromBody(post.body), [post.body]);

    // Spot posts get a rich, tappable location header instead of the raw
    // "Spot Name:" / "🌐 lat, lng (address)" text lines.
    const spot = useMemo(() => parseSpotBody(post.body), [post.body]);

    // Extract thumbnail for video posts from json_metadata
    const videoThumbnailUrl = useMemo(() => {
      if (!media.some((m) => m.type === "video")) return null;
      try {
        const raw =
          (post as any).post_json_metadata || (post as any).json_metadata;
        const metadata = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (metadata?.image?.[0]) return metadata.image[0];
      } catch {}
      // Fallback: first image in the body
      const firstImage = media.find((m) => m.type === "image");
      return firstImage?.url || null;
    }, [post, media]);

    // Memoize post content processing - remove iframes, images, and video links
    const postContent = useMemo(() => {
      // For spot posts, drop the parsed header lines (name + coords) — they're
      // rendered by SpotLocationLine — and keep only the description + media.
      let content = spot ? spot.rest : post.body;
      // Remove iframes (multiline) and images
      content = content.replace(
        /<iframe[\s\S]*?<\/iframe>|!\[.*?\]\(.*?\)/gi,
        "",
      );
      // Remove plain video URLs (YouTube and Odysee)
      content = removeVideoLinksFromBody(content);
      return content.trim();
    }, [post.body, spot]);

    // Memoize formatted date
    const formattedDate = useMemo(() => {
      const dateStr = post.created;
      if (!dateStr) return "";
      const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
      if (isNaN(date.getTime())) return "";
      return formatTimeAbbreviated(date);
    }, [post.created]);

    // Check if user has already voted on this post
    useEffect(() => {
      if (currentUsername && Array.isArray(post.active_votes)) {
        const hasVoted = post.active_votes.some(
          (vote: any) => vote.voter === currentUsername && vote.weight > 0,
        );
        setIsLiked(hasVoted);
      }
    }, [post.active_votes, currentUsername]);

    const handleMediaPress = useCallback((media: Media) => {
      setSelectedMedia(media);
      setIsModalVisible(true);
    }, []);

    const handleVote = async (customWeight?: number) => {
      try {
        setIsVoting(true);

        if (!session || !session.username || !canPost(session)) {
          showToast("Please login first", "error");
          return;
        }

        if (session.username === "SPECTATOR") {
          showToast("Please login first", "error");
          return;
        }

        // Trigger haptic feedback before the vote
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Calculate vote value before submitting
        const votePercentage = customWeight ?? voteWeight;
        let estimatedValue = 0;

        try {
          if (!isVoteValueLoading) {
            estimatedValue = await estimateVoteValue(votePercentage);
          }
        } catch (err) {
          // Continue with vote even if estimation fails
        }

        // Optimistically update the UI
        const previousLikedState = isLiked;
        const previousVoteCount = voteCount;
        const previousPayoutValue = payoutValue;

        setIsLiked(!isLiked);
        setVoteCount((prevCount) =>
          previousLikedState ? prevCount - 1 : prevCount + 1,
        );

        // Update payout value if we have an estimation and user is voting (not unvoting)
        if (estimatedValue > 0 && !previousLikedState) {
          setPayoutValue((prev) => prev + estimatedValue);
        }

        try {
          // Routes to the server for email (userbase) accounts, signs locally
          // for classic Hive-key accounts.
          await castVote(
            session,
            post.author,
            post.permlink,
            previousLikedState ? 0 : Math.round(votePercentage * 100),
          );

          // Show simple success toast
          showToast("Vote submitted!", "success");
        } catch (err) {
          // Revert the optimistic updates if the request failed
          setIsLiked(previousLikedState);
          setVoteCount(previousVoteCount);
          setPayoutValue(previousPayoutValue);
          throw err;
        }
      } catch (error) {
        let errorMessage = "Failed to vote";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        showToast(errorMessage, "error");
      } finally {
        setIsVoting(false);
        setShowSlider(false);
      }
    };

    const calculateTotalValue = () => {
      return payoutValue.toFixed(2);
    };

    // The whole action row (icons, counters and payout) shifts to the accent
    // colour once the viewer has voted — the row reads as one unit.
    const rowColor = isLiked ? theme.colors.primary : theme.colors.text;

    const handleProfilePress = () => {
      router.push({
        pathname: "/(tabs)/profile",
        params: { username: post.author },
      });
    };

    const handleConversationPress = () => {
      if (onOpenFullConversation) {
        onOpenFullConversation(post);
      } else {
        setIsFullConversationVisible(true);
      }
    };

    const handleBodyPress = () => {
      if (onOpenFullConversation) {
        onOpenFullConversation(post);
      } else {
        setIsFullConversationVisible(true);
      }
    };

    const handleUserMenuPress = () => {
      setShowUserMenu(true);
    };

    const handleUserAction = async (action: "follow" | "unfollow" | "mute") => {
      if (!session || session.username === "SPECTATOR") {
        showToast("Please login first", "error");
        return;
      }

      try {
        let relationship: "blog" | "ignore" | "" = "";
        let successMessage = "";

        switch (action) {
          case "follow":
            relationship = "blog";
            successMessage = `Following ${post.author}`;
            break;
          case "unfollow":
            relationship = "";
            successMessage = `Unfollowed ${post.author}`;
            break;
          case "mute":
            relationship = "ignore";
            successMessage = `Muted ${post.author}`;
            break;
        }

        await updateUserRelationship(post.author, relationship);
        showToast(successMessage, "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Failed to update relationship",
          "error",
        );
      } finally {
        setShowUserMenu(false);
      }
    };

    const handleReportPost = () => {
      setShowReportModal(true);
      setShowUserMenu(false);
    };

    const handleSubmitReport = async () => {
      if (!selectedReportReason) {
        showToast("Please select a reason for reporting", "error");
        return;
      }

      if (!session || !canPost(session)) {
        showToast("Please login first", "error");
        return;
      }

      try {
        setIsSubmittingReport(true);

        // Routes to the server for email (userbase) accounts, signs locally for
        // classic key accounts. Throws on failure.
        await submitReport(session, {
          reportedAuthor: post.author,
          reportedPermlink: post.permlink,
          reason: selectedReportReason,
          additionalInfo: reportAdditionalInfo,
        });

        showToast("Report submitted successfully", "success");
        setShowReportModal(false);
        setSelectedReportReason("");
        setReportAdditionalInfo("");
      } catch (error) {
        let errorMessage = "Failed to submit report";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        showToast(errorMessage, "error");
      } finally {
        setIsSubmittingReport(false);
      }
    };

    // Create dynamic styles based on theme with Fira Code font

    return (
      <>
        <View style={styles.container}>
          {/* Two-column layout: Profile pic | Everything else */}
          <View style={styles.mainLayout}>
            {/* Left column: Profile pic only */}
            <View style={styles.leftColumn}>
              <Pressable onPress={handleProfilePress}>
                <Image
                  source={{
                    uri: displayAvatar,
                  }}
                  style={styles.profileImage}
                  transition={200}
                  recyclingKey={displayAuthor}
                />
              </Pressable>
            </View>

            {/* Right column: All content */}
            <View style={styles.rightColumn}>
              {/* Header with author and date */}
              <View style={styles.headerContainer}>
                <Pressable onPress={handleProfilePress}>
                  <Text style={styles.authorText}>{displayAuthor}</Text>
                </Pressable>
                <Text style={styles.dateText}>{formattedDate}</Text>

                {/* Three dots menu - only show if not viewing own post */}
                {currentUsername && post.author !== currentUsername && (
                  <Pressable
                    onPress={handleUserMenuPress}
                    style={styles.menuButton}
                  >
                    <FontAwesome
                      name="ellipsis-h"
                      size={16}
                      color={theme.colors.text}
                    />
                  </Pressable>
                )}
              </View>

              {/* Spot location — rich, tappable Google Maps link */}
              {spot && (
                <SpotLocationLine
                  name={spot.name}
                  lat={spot.lat}
                  lng={spot.lng}
                  address={spot.address}
                />
              )}

              {/* Content */}
              <Pressable onPress={handleBodyPress}>
                {postContent !== "" && (
                  <View style={styles.contentContainer}>
                    <EnhancedMarkdownRenderer content={postContent} />
                  </View>
                )}
              </Pressable>

              {/* Media - outside Pressable so clicks don't open conversation */}
              {media.length > 0 && (
                <View style={styles.mediaContainer}>
                  <MediaPreview
                    media={media}
                    onMediaPress={handleMediaPress}
                    selectedMedia={selectedMedia}
                    isModalVisible={isModalVisible}
                    onCloseModal={() => setIsModalVisible(false)}
                    isVisible={isVisible}
                    thumbnailUrl={videoThumbnailUrl}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Full-width action bar — outside mainLayout for better thumb reach */}
          <View style={styles.bottomBar}>
            {showSlider ? (
              /* Voting slider mode - takes entire bottom bar */
              <View style={styles.votingSliderContainer}>
                <VotingSlider
                  value={voteWeight}
                  onValueChange={setVoteWeight}
                  minimumValue={1}
                  maximumValue={100}
                />
                <View style={styles.sliderControls}>
                  <Pressable
                    style={styles.cancelVoteButton}
                    onPress={() => setShowSlider(false)}
                    disabled={isVoting}
                  >
                    <FontAwesome
                      name="times"
                      size={22}
                      color={theme.colors.gray}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.confirmVoteButton,
                      isVoting && styles.disabledButton,
                    ]}
                    onPress={() => handleVote(voteWeight)}
                    disabled={isVoting}
                  >
                    {isVoting ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.green}
                      />
                    ) : (
                      <FontAwesome
                        name="arrow-up"
                        size={22}
                        color={theme.colors.green}
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Normal bottom bar mode */
              <>
                <View style={styles.actionsContainer}>
                  {/* Voting section */}
                  <Pressable
                    onPress={() => setShowSlider(true)}
                    style={({ pressed }) => [
                      styles.actionItem,
                      styles.voteItem,
                      { opacity: isVoting ? 0.5 : pressed ? 0.7 : 0.9 },
                    ]}
                    disabled={isVoting}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="button"
                    // The count is hidden at 0, so the label carries it — an
                    // icon-only control would otherwise announce nothing.
                    accessibilityLabel={
                      isLiked
                        ? `Voted, ${voteCount} votes`
                        : `Upvote, ${voteCount} votes`
                    }
                    accessibilityState={{ selected: isLiked, disabled: isVoting }}
                    accessibilityHint="Double tap to choose a vote weight"
                  >
                    <View style={styles.iconBox}>
                      {isLiked ? (
                        <Check size={ACTION_ICON_SIZE} color={rowColor} />
                      ) : (
                        <ArrowUp size={ACTION_ICON_SIZE} color={rowColor} />
                      )}
                    </View>
                    {voteCount > 0 && (
                      <Text style={[styles.actionText, { color: rowColor }]}>
                        {voteCount}
                      </Text>
                    )}
                  </Pressable>

                  {/* Purely decorative — never announce a stray "|" between
                      the two controls. */}
                  <Text
                    style={styles.actionSeparator}
                    selectable={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    |
                  </Text>

                  {/* Replies section - clickable to open conversation */}
                  <Pressable
                    onPress={handleConversationPress}
                    style={({ pressed }) => [
                      styles.actionItem,
                      styles.commentItem,
                      { opacity: pressed ? 0.7 : 0.9 },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${post.children} replies`}
                    accessibilityHint="Double tap to open the conversation"
                  >
                    <View style={styles.iconBox}>
                      <FontAwesome
                        name="comment-o"
                        size={ACTION_ICON_SIZE}
                        color={rowColor}
                      />
                    </View>
                    <Text style={[styles.actionText, { color: rowColor }]}>
                      {post.children}
                    </Text>
                  </Pressable>
                </View>

                {/* "$" and the amount are separate Texts for spacing, so group
                    them for screen readers instead of announcing two fragments. */}
                <View
                  style={styles.payoutContainer}
                  accessible
                  accessibilityLabel={`Payout ${calculateTotalValue()} dollars`}
                >
                  <Text style={[styles.payoutText, { color: rowColor }]}>$</Text>
                  <Text style={[styles.payoutText, { color: rowColor }]}>
                    {calculateTotalValue()}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Conversation drawer — only mounted when parent doesn't provide a callback (fallback mode) */}
        {!onOpenFullConversation && isFullConversationVisible && (
          <React.Suspense fallback={null}>
            <FullConversationDrawer
              visible={isFullConversationVisible}
              onClose={() => setIsFullConversationVisible(false)}
              author={post.author}
              permlink={post.permlink}
            />
          </React.Suspense>
        )}

        {/* User Menu Modal */}
        <Modal
          visible={showUserMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUserMenu(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowUserMenu(false)}
          >
            <View style={styles.userMenuContainer}>
              <Text style={styles.userMenuTitle}>@{post.author}</Text>

              {followingList.includes(post.author) ? (
                <Pressable
                  style={styles.userMenuButton}
                  onPress={() => handleUserAction("unfollow")}
                >
                  <Text style={styles.userMenuButtonText}>Unfollow</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.userMenuButton}
                  onPress={() => handleUserAction("follow")}
                >
                  <Text style={styles.userMenuButtonText}>Follow</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.userMenuButton}
                onPress={() => handleUserAction("mute")}
              >
                <Text style={styles.userMenuButtonText}>Mute/Block</Text>
              </Pressable>

              <Pressable
                style={styles.userMenuButton}
                onPress={() => handleReportPost()}
              >
                <Text style={styles.userMenuButtonText}>Report Post</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Report Modal */}
        <Modal
          visible={showReportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.reportModalContainer}>
              <ScrollView style={styles.reportModalContent}>
                <Text style={styles.reportModalTitle}>Report Post</Text>
                <Text style={styles.reportModalSubtitle}>@{post.author}</Text>

                <Text style={styles.reportSectionTitle}>
                  Reason for reporting:
                </Text>

                {[
                  "Spam",
                  "Harassment or Abuse",
                  "Inappropriate Content",
                  "Copyright Violation",
                  "Misinformation",
                  "Other",
                ].map((reason) => (
                  <Pressable
                    key={reason}
                    style={[
                      styles.reportReasonButton,
                      selectedReportReason === reason &&
                        styles.reportReasonButtonSelected,
                    ]}
                    onPress={() => setSelectedReportReason(reason)}
                  >
                    <Text
                      style={[
                        styles.reportReasonText,
                        selectedReportReason === reason &&
                          styles.reportReasonTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                ))}

                <Text style={styles.reportSectionTitle}>
                  Additional Information (Optional):
                </Text>
                <TextInput
                  style={styles.reportTextInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Provide additional details about this report..."
                  placeholderTextColor={theme.colors.gray}
                  value={reportAdditionalInfo}
                  onChangeText={setReportAdditionalInfo}
                  editable={!isSubmittingReport}
                />

                <View style={styles.reportModalButtons}>
                  <Pressable
                    style={[
                      styles.reportModalButton,
                      styles.reportCancelButton,
                    ]}
                    onPress={() => setShowReportModal(false)}
                    disabled={isSubmittingReport}
                  >
                    <Text style={styles.reportCancelButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.reportModalButton,
                      styles.reportSubmitButton,
                      (!selectedReportReason || isSubmittingReport) &&
                        styles.reportSubmitButtonDisabled,
                    ]}
                    onPress={handleSubmitReport}
                    disabled={!selectedReportReason || isSubmittingReport}
                  >
                    {isSubmittingReport ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.reportSubmitButtonText}>
                        Submit Report
                      </Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 0,
    backgroundColor: theme.colors.card,
    padding: 0,
  },
  mainLayout: {
    flexDirection: "row",
  },
  leftColumn: {
    width: 42, // Fixed width for profile pic column
    marginRight: theme.spacing.sm,
  },
  rightColumn: {
    flex: 1, // Takes remaining space
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: 0,
  },
  authorText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    fontWeight: "bold",
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  dateText: {
    fontSize: theme.fontSizes.xs, // Force consistent font size
    color: theme.colors.muted,
  },
  contentContainer: {
    marginBottom: 0,
  },
  contentText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.text,
    lineHeight: 20,
    fontFamily: theme.fonts.default,
  },
  linkText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.green,
    textDecorationLine: "underline",
  },
  mentionText: {
    fontSize: theme.fontSizes.md, // Force consistent font size
    color: theme.colors.green,
    fontWeight: "bold",
    fontFamily: theme.fonts.bold,
  },
  mediaContainer: {
    marginBottom: 0,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  payoutContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
  },
  payoutText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  voteItem: {
    gap: theme.spacing.xs,
  },
  commentItem: {
    gap: 6,
  },
  // Fixed box so the counter doesn't shift when the icon swaps (↑ ↔ ✓).
  iconBox: {
    width: ACTION_ICON_SIZE,
    height: ACTION_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSeparator: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.gray,
  },
  actionText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.xs,
  },
  disabledButton: {
    opacity: 0.7,
  },
  // New styles for full-width voting slider
  votingSliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 40,
    marginBottom: theme.spacing.xxs,
  },
  sliderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  cancelVoteButton: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  confirmVoteButton: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  menuButton: {
    padding: theme.spacing.sm,
    marginLeft: "auto",
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  userMenuContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    minWidth: 200,
  },
  userMenuTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: "center",
    fontFamily: theme.fonts.bold,
  },
  userMenuButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(50, 205, 50, 0.1)",
  },
  userMenuButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    textAlign: "center",
    fontFamily: theme.fonts.regular,
  },
  // Report Modal Styles
  reportModalContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    margin: theme.spacing.md,
    maxHeight: "80%",
    width: "90%",
    alignSelf: "center",
  },
  reportModalContent: {
    padding: theme.spacing.lg,
  },
  reportModalTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.bold,
  },
  reportModalSubtitle: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.regular,
  },
  reportSectionTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.bold,
  },
  reportReasonButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray,
    backgroundColor: "transparent",
  },
  reportReasonButtonSelected: {
    backgroundColor: "rgba(50, 205, 50, 0.2)",
    borderColor: theme.colors.green,
  },
  reportReasonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    textAlign: "center",
    fontFamily: theme.fonts.regular,
  },
  reportReasonTextSelected: {
    color: theme.colors.green,
    fontWeight: "bold",
    fontFamily: theme.fonts.bold,
  },
  reportTextInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    textAlignVertical: "top",
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.regular,
  },
  reportModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  reportModalButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.gray,
  },
  reportCancelButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.gray,
    fontFamily: theme.fonts.regular,
  },
  reportSubmitButton: {
    backgroundColor: theme.colors.green,
  },
  reportSubmitButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.5,
  },
  reportSubmitButtonText: {
    fontSize: theme.fontSizes.md,
    color: "#000",
    fontWeight: "bold",
    fontFamily: theme.fonts.bold,
  },
});
