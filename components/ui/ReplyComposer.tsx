import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { VideoPlayer } from '../Feed/VideoPlayer';
import { useAuth } from '~/lib/auth-provider';
import { useToast } from '~/lib/toast-provider';
import { createHiveComment } from '~/lib/upload/post-utils';
import { uploadVideoToWorker, createVideoIframe } from '~/lib/upload/video-upload';
import { uploadImageToHive, createImageMarkdown } from '~/lib/upload/image-upload';
import { theme } from '~/lib/theme';
import type { Discussion } from '@hiveio/dhive';

interface ReplyComposerProps {
  parentAuthor: string;
  parentPermlink: string;
  onReplySuccess?: (newReply: Discussion) => void;
  placeholder?: string;
  buttonLabel?: string;
}

export function ReplyComposer({
  parentAuthor,
  parentPermlink,
  onReplySuccess,
  placeholder = "Write here",
  buttonLabel = "REPLY"
}: ReplyComposerProps) {
  const { username, session } = useAuth();
  const { showToast } = useToast();
  
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSelectingMedia, setIsSelectingMedia] = useState(false);
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

        if (asset.mimeType) {
          setMediaMimeType(asset.mimeType);
        } else {
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
            setMediaMimeType(imageMimeTypes[fileExtension || ""] || "image/jpeg");
          } else {
            const videoMimeTypes: Record<string, string> = {
              mp4: "video/mp4",
              mov: "video/quicktime",
              avi: "video/x-msvideo",
              wmv: "video/x-ms-wmv",
              webm: "video/webm",
            };
            setMediaMimeType(videoMimeTypes[fileExtension || ""] || "video/mp4");
          }
        }
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
  };

  const handleReply = async () => {
    if (!content.trim() && !media) {
      Alert.alert("Validation Error", "Please add some content to your reply");
      return;
    }

    if (!username || username === "SPECTATOR" || !session?.decryptedKey) {
      Alert.alert("Authentication Required", "Please log in to reply");
      return;
    }

    setIsUploading(true);
    setUploadProgress("");

    try {
      let replyBody = content;
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
            const imageMarkdown = createImageMarkdown(imageResult.url, "Uploaded image");
            replyBody += replyBody ? `\n\n${imageMarkdown}` : imageMarkdown;
            
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
            const videoIframe = createVideoIframe(videoResult.gatewayUrl, "Video");
            replyBody += replyBody ? `\n\n${videoIframe}` : videoIframe;
            
          } catch (videoError) {
            console.error("Video upload failed:", videoError);
            throw new Error("Failed to upload video. Please try again.");
          }
        }
      }

      setUploadProgress("Posting reply...");

      // Post reply to blockchain
      await createHiveComment(
        replyBody,
        parentAuthor,
        parentPermlink,
        {
          username,
          privateKey: session.decryptedKey,
        }
      );

      // Create optimistic reply object - simplified to avoid type conflicts
      const newReply = {
        author: username,
        permlink: `reply-${Date.now()}`,
        body: replyBody,
        created: new Date().toISOString(),
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        children: 0,
        active_votes: [],
        pending_payout_value: '0.000 HBD',
        total_payout_value: '0.000 HBD',
        total_pending_payout_value: '0.000 HBD',
        curator_payout_value: '0.000 HBD',
        root_comment: 0,
        id: Date.now(),
        category: '',
        title: '',
        json_metadata: '{}',
        last_update: new Date().toISOString(),
        active: new Date().toISOString(),
        last_payout: '1970-01-01T00:00:00',
        depth: 0,
        net_rshares: '0',
        abs_rshares: '0',
        vote_rshares: '0',
        children_abs_rshares: '0',
        cashout_time: '1969-12-31T23:59:59',
        max_cashout_time: '1969-12-31T23:59:59',
        total_vote_weight: '0',
        reward_weight: 10000,
        author_rewards: '0',
        net_votes: 0,
        max_accepted_payout: '1000000.000 HBD',
        percent_hbd: 10000,
        allow_replies: true,
        allow_votes: true,
        allow_curation_rewards: true,
        beneficiaries: [],
        url: `/@${username}/reply-${Date.now()}`,
        root_title: '',
        replies: [],
        author_reputation: 0,
        promoted: '0.000 HBD',
        body_length: replyBody.length,
        reblogged_by: [],
        blacklists: [],
      } as unknown as Discussion;

      // Call success callback
      if (onReplySuccess) {
        onReplySuccess(newReply);
      }

      // Clear form
      setContent("");
      setMedia(null);
      setMediaType(null);
      setMediaMimeType(null);

      showToast('Reply posted successfully!', 'success');
      Keyboard.dismiss();
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      Alert.alert("Error", errorMsg);
      console.error("Reply error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  if (username === "SPECTATOR") {
    return (
      <View style={styles.spectatorContainer}>
        <Text style={styles.spectatorText}>Please log in to reply</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Upload Progress */}
      {uploadProgress ? (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{uploadProgress}</Text>
        </View>
      ) : null}

      {/* Media Preview */}
      {media && (
        <View style={styles.mediaPreview}>
          {mediaType === "image" ? (
            <Image source={{ uri: media }} style={styles.mediaImage} />
          ) : (
            <VideoPlayer url={media} playing={false} />
          )}
          <Pressable onPress={removeMedia} style={styles.removeButton}>
            <Ionicons name="close" size={16} color="white" />
          </Pressable>
        </View>
      )}

      {/* Reply Input and Actions */}
      <View style={styles.inputContainer}>
        <TextInput
          multiline
          placeholder={placeholder}
          value={content}
          onChangeText={setContent}
          style={styles.textInput}
          placeholderTextColor={theme.colors.gray}
          maxLength={500}
        />
        
        <View style={styles.actionsRow}>
          {/* Media Buttons */}
          <View style={styles.mediaButtons}>
            <Pressable
              onPress={pickMedia}
              style={styles.mediaButton}
              disabled={isUploading || isSelectingMedia}
            >
              <Ionicons 
                name="image-outline" 
                size={20} 
                color={isSelectingMedia ? theme.colors.gray : theme.colors.green} 
              />
            </Pressable>
            
            <Pressable
              onPress={pickMedia}
              style={styles.mediaButton}
              disabled={isUploading || isSelectingMedia}
            >
              <Ionicons 
                name="videocam-outline" 
                size={20} 
                color={isSelectingMedia ? theme.colors.gray : theme.colors.green} 
              />
            </Pressable>
          </View>

          {/* Reply Button */}
          <Pressable
            onPress={handleReply}
            style={[
              styles.replyButton,
              ((!content.trim() && !media) || isUploading) && styles.replyButtonDisabled
            ]}
            disabled={(!content.trim() && !media) || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.replyButtonText}>{buttonLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
  },
  spectatorContainer: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  spectatorText: {
    color: theme.colors.muted,
    fontSize: theme.fontSizes.sm,
  },
  progressContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressText: {
    color: theme.colors.green,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    maxHeight: 200,
  },
  mediaImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  inputContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  textInput: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.default,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  mediaButton: {
    padding: theme.spacing.xs,
  },
  replyButton: {
    backgroundColor: theme.colors.green,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  replyButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  replyButtonText: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
    fontFamily: theme.fonts.bold,
  },
});
