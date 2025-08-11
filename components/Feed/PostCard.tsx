import React, { useCallback, useState, useEffect } from 'react';
import { FontAwesome } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
// import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, View, Linking, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
// import { API_BASE_URL } from '~/lib/constants';
import { vote as hiveVote } from '~/lib/hive-utils';
import { useAuth } from '~/lib/auth-provider';
import { Text } from '../ui/text';
import { MediaPreview } from './MediaPreview';
import { useToast } from '~/lib/toast-provider';
import type { Media, Post } from '../../lib/types';
import { extractMediaFromBody } from '~/lib/utils';

interface PostCardProps {
  post: Post;
  currentUsername: string | null;
}

export function PostCard({ post, currentUsername }: PostCardProps) {
  const { session } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [voteWeight, setVoteWeight] = useState(100);
  const [isLiked, setIsLiked] = useState(false);
  const [voteCount, setVoteCount] = useState(post.votes.filter(vote => vote.weight > 0).length);
  const { showToast } = useToast();

  // Check if user has already voted on this post
  useEffect(() => {
    if (currentUsername && post.votes) {
      const hasVoted = post.votes.some(vote => vote.voter === currentUsername && vote.weight > 0);
      setIsLiked(hasVoted);
    }
  }, [post.votes, currentUsername]);

  const handleMediaPress = useCallback((media: Media) => {
    setSelectedMedia(media);
    setIsModalVisible(true);
  }, []);

  const handleVote = async (customWeight?: number) => {
    try {
      setIsVoting(true);

      if (!session || !session.username || !session.decryptedKey) {
        showToast('Please login first', 'error');
        return;
      }

      if (session.username === "SPECTATOR") {
        showToast('Please login first', 'error');
        return;
      }

      // Trigger haptic feedback before the vote
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Optimistically update the UI
      const previousLikedState = isLiked;
      setIsLiked(!isLiked);
      setVoteCount(prevCount => previousLikedState ? prevCount - 1 : prevCount + 1);

      try {
        await hiveVote(
          session.decryptedKey,
          session.username,
          post.author,
          post.permlink,
          previousLikedState ? 0 : Math.round((customWeight ?? voteWeight) * 100)
        );
      } catch (err) {
        // Revert the optimistic update if the request failed
        setIsLiked(previousLikedState);
        setVoteCount(prevCount => previousLikedState ? prevCount + 1 : prevCount - 1);
        throw err;
      }
    } catch (error) {
      let errorMessage = 'Failed to vote';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsVoting(false);
      setShowSlider(false);
    }
  };

  const calculateTotalValue = (post: Post) => {
    const pending = parseFloat(post.pending_payout_value);
    const total = parseFloat(post.total_payout_value);
    const curator = parseFloat(post.curator_payout_value);
    return (pending + total + curator).toFixed(3);
  };

  const navigateToProfile = (username: string) => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username }
    });
  };

  const media = extractMediaFromBody(post.body);
  const postContent = post.body.replace(/<iframe.*?<\/iframe>|!\[.*?\]\(.*?\)/g, '').trim();
  
  // Process post content to handle @username mentions and URLs
  const renderPostContent = () => {
    if (!postContent) return null;
    
    // First, split by URLs
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    // Then process @username mentions in each non-URL part
    const mentionRegex = /(@[a-zA-Z0-9.-]+)/g;
    
    return postContent.split(linkRegex).map((part, index) => {
      // If this part is a URL, make it a clickable link
      if (linkRegex.test(part)) {
        return (
          <Text
            key={`link-${index}`}
            className="text-green-600 underline"
            onPress={() => Linking.openURL(part)}
          >
            {part}
          </Text>
        );
      }
      
      // If not a URL, process for @username mentions
      const segments = part.split(mentionRegex);
      if (segments.length === 1) {
        // No mentions in this part
        return <Text key={`text-${index}`} className="text-lg">{part}</Text>;
      }
      
      // Process parts with mentions
      return (
        <Text key={`text-${index}`} className="text-lg">
          {segments.map((segment, segmentIndex) => {
            // Check if this segment is a mention
            if (mentionRegex.test(segment)) {
              const username = segment.substring(1); // Remove @ symbol
              return (
                <Text
                  key={`mention-${segmentIndex}`}
                  className="text-green-600 font-bold"
                  onPress={() => navigateToProfile(username)}
                >
                  {segment}
                </Text>
              );
            }
            // Regular text segment
            return <Text key={`segment-${segmentIndex}`}>{segment}</Text>;
          })}
        </Text>
      );
    });
  };

  const handleProfilePress = () => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { username: post.author }
    });
  };

  return (
    <View className="w-full mb-4">
      <Pressable onPress={handleProfilePress} className="flex-row items-center justify-between mb-3 px-2">
        <View className="flex-row items-center">
          <View className="h-12 w-12 mr-3 rounded-full overflow-hidden">
            <Image
              source={{ uri: `https://images.ecency.com/webp/u/${post.author}/avatar/small` }}
              className="w-full h-full border border-muted rounded-full"
              alt={`${post.author}'s avatar`}
            />
          </View>
          <View>
            <Text className="font-bold text-lg">@{post.author}</Text>
          </View>
        </View>
        <Text className="text-gray-500">
          {(() => {
            const dateStr = post.created;
            if (!dateStr) return '';
            const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
            if (isNaN(date.getTime())) return '';
            return formatDistanceToNow(date, { addSuffix: true });
          })()}
        </Text>
      </Pressable>

      {postContent !== '' && (
        <View className="px-2 mb-2">
          {renderPostContent()}
        </View>
      )}

      {media.length > 0 && (
        <MediaPreview
          media={media}
          onMediaPress={handleMediaPress}
          selectedMedia={selectedMedia}
          isModalVisible={isModalVisible}
          onCloseModal={() => setIsModalVisible(false)}
        />
      )}

      <View className="flex-row justify-between items-center mx-2">
        <Text className={`font-bold text-xl ${parseFloat(calculateTotalValue(post)) > 0 ? 'text-green-500' : 'text-gray-500'}`}>
          ${calculateTotalValue(post)}
        </Text>
        <View>
          {showSlider ? (
            <View className="flex-col items-center bg-background rounded-xl p-3 shadow-lg w-48">
              <Text className="mb-2 text-center text-base font-semibold">Vote Weight: {voteWeight}%</Text>
              <Slider
                style={{ width: 150, height: 40 }}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={voteWeight}
                onValueChange={setVoteWeight}
                minimumTrackTintColor="#32CD32"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#32CD32"
              />
              <View className="flex-row gap-2 mt-2">
                <Pressable
                  className="bg-gray-200 px-3 py-1 rounded"
                  onPress={() => setShowSlider(false)}
                  disabled={isVoting}
                >
                  <Text className="text-gray-700">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`bg-green-500 px-3 py-1 rounded ${isVoting ? 'opacity-70' : ''}`}
                  onPress={() => handleVote(voteWeight)}
                  disabled={isVoting}
                >
                  {isVoting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">Confirm</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowSlider(true)}
              className={`flex-row items-center gap-1 ${isVoting ? 'opacity-70' : ''}`}
              disabled={isVoting}
            >
              {isVoting ? (
                <ActivityIndicator 
                  size="small" 
                  color={isLiked ? "#32CD32" : "#666666"}
                  style={{ marginRight: 4, marginLeft: 4 }}
                />
              ) : (
                <>
                  <Text className={`text-xl font-bold ${isLiked ? 'text-green-500' : 'text-gray-600'}`}>
                    {voteCount}
                  </Text>
                  <FontAwesome
                    name={"arrow-up"}
                    size={20}
                    color={isLiked ? "#32CD32" : "#666666"}
                    style={{ marginRight: 4 }}
                  />
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}