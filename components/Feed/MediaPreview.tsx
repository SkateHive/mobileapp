import React, { useState } from 'react';
import { Image, Modal, Pressable, View, Dimensions, StyleSheet } from 'react-native';
import { VideoPlayer } from './VideoPlayer';
import type { Media } from '../../lib/types';
import { FontAwesome } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface MediaPreviewProps {
  media: Media[];
  onMediaPress: (media: Media) => void;
  selectedMedia: Media | null;
  isModalVisible: boolean;
  onCloseModal: () => void;
}

// For calculating image dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAX_IMAGE_HEIGHT = screenHeight * 0.75;

export function MediaPreview({
  media,
  onMediaPress,
  selectedMedia,
  isModalVisible,
  onCloseModal,
}: MediaPreviewProps) {
  // Track dimensions for each image to maintain proper aspect ratio
  const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number, height: number }>>({});
  // Track which videos are playing
  const [playingVideos, setPlayingVideos] = useState<Record<number, boolean>>({});
  // Track which videos have had their initial interaction (play button clicked)
  const [interactedVideos, setInteractedVideos] = useState<Record<number, boolean>>({});

  // Handle initial video play - this will only work for the first interaction
  const handleInitialPlay = (index: number) => {
    // Only handle the press if the video hasn't been interacted with
    if (!interactedVideos[index]) {
      // Start playing the video
      setPlayingVideos(prev => ({
        ...prev,
        [index]: true
      }));
      
      // Mark this video as interacted with
      setInteractedVideos(prev => ({
        ...prev,
        [index]: true
      }));
    }
  };

  // Determine if a specific video is playing
  const isVideoPlaying = (index: number) => {
    return !!playingVideos[index];
  };
  
  // Determine if a specific video has been interacted with
  const hasVideoBeenInteracted = (index: number) => {
    return !!interactedVideos[index];
  };

  // Calculate appropriate dimensions when image loads
  const handleImageLoad = (index: number, width: number, height: number) => {
    setImageDimensions(prev => ({
      ...prev,
      [index]: { width, height }
    }));
  };

  // Calculate display width based on number of media items
  const getContainerWidth = (index: number) => {
    const containerWidth = media.length === 1 
      ? screenWidth - 16 // Full width (minus padding)
      : (screenWidth - 24) / 2; // Half width (minus padding and gap)
    
    return containerWidth;
  };

  // Calculate height based on image's aspect ratio with a maximum constraint
  const getImageHeight = (index: number) => {
    const dimensions = imageDimensions[index];
    if (!dimensions) return 200; // Default height until image loads
    
    const containerWidth = getContainerWidth(index);
    const aspectRatio = dimensions.width / dimensions.height;
    const calculatedHeight = containerWidth / aspectRatio;
    
    // Apply maximum height constraint (3/4 of screen height)
    return Math.min(calculatedHeight, MAX_IMAGE_HEIGHT);
  };

  return (
    <>
      {/* Preview */}
      <View style={styles.container}>
        {media.map((item, index) => (
          <View
            key={index}
            style={[
              styles.mediaContainer,
              media.length === 1 ? styles.singleMedia : styles.multipleMedia,
              { height: item.type === 'video' ? 200 : getImageHeight(index) }
            ]}
          >
            {item.type === 'video' ? (
              // Only make it a Pressable if the video hasn't been interacted with yet
              hasVideoBeenInteracted(index) ? (
                // After interaction, just render the video player without pressable wrapper
                <VideoPlayer url={item.url} playing={isVideoPlaying(index)} />
              ) : (
                // Before first interaction, use Pressable with play button overlay
                <Pressable 
                  style={styles.fullSize} 
                  onPress={() => handleInitialPlay(index)}
                >
                  <VideoPlayer url={item.url} playing={false} />
                  
                  {/* Play button overlay - only shown before first interaction */}
                  <View style={styles.playOverlay}>
                    <FontAwesome name="play-circle" size={50} color="white" />
                  </View>
                </Pressable>
              )
            ) : (
              <Pressable
                onPress={() => onMediaPress(item)}
                style={styles.fullSize}
              >
                <Image
                  source={{ uri: item.url }}
                  style={styles.fullSize}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    handleImageLoad(index, width, height);
                  }}
                />
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {/* Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        onRequestClose={onCloseModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={onCloseModal}
        >
          <View style={styles.modalContent}>
            {selectedMedia?.type === 'image' ? (
              <Image
                source={{ uri: selectedMedia.url }}
                style={styles.fullSize}
                resizeMode="contain"
              />
            ) : selectedMedia?.type === 'video' ? (
              <VideoPlayer url={selectedMedia.url} playing={true} />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: theme.spacing.md,
  },
  mediaContainer: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme.colors.muted,
  },
  singleMedia: {
    width: '100%',
  },
  multipleMedia: {
    width: '49%',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
  },
});