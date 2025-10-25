import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { useAuth } from '~/lib/auth-provider';
import { getFeed } from '~/lib/api';
import { extractMediaFromBody } from '~/lib/utils';
import { theme } from '~/lib/theme';
import type { Post } from '~/lib/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoPost {
  videoUrl: string;
  username: string;
  permlink: string;
  author: string;
}

export default function VideosScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setIsLoading(true);
      const posts = await getFeed(1, 50); // Load more posts to get more videos
      
      // Extract videos from posts
      const videoList: VideoPost[] = [];
      
      posts.forEach((post: Post) => {
        const media = extractMediaFromBody(post.body);
        const videoMedia = media.filter(m => m.type === 'video');
        
        videoMedia.forEach(video => {
          videoList.push({
            videoUrl: video.url,
            username: post.author,
            permlink: post.permlink,
            author: post.author,
          });
        });
      });
      
      setVideos(videoList);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderVideo = ({ item, index }: { item: VideoPost; index: number }) => {
    const isActive = index === currentIndex;

    return (
      <View style={styles.videoContainer}>
        <VideoPlayer url={item.videoUrl} playing={isActive} contentFit="cover" />
        
        {/* Username overlay */}
        <View style={styles.usernameContainer}>
          <Text style={styles.usernameText}>@{item.username}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Video list */}
      {videos.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={renderVideo}
          keyExtractor={(item, index) => `${item.permlink}-${index}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          windowSize={3}
          initialScrollIndex={0}
          getItemLayout={(data, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={64} color={theme.colors.gray} />
          <Text style={styles.emptyText}>No videos found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  usernameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: theme.colors.gray,
    fontSize: 16,
  },
});
