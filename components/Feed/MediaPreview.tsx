import React, { useState } from 'react';
import { Image, Modal, Pressable, View, Dimensions, StyleSheet } from 'react-native';
import { VideoPlayer } from './VideoPlayer';
import { VideoWithAutoplay } from './VideoWithAutoplay';
import { EmbedPlayer } from './EmbedPlayer';
import type { Media } from '../../lib/types';
import { FontAwesome } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface MediaPreviewProps {
  media: Media[];
  onMediaPress: (media: Media) => void;
  selectedMedia: Media | null;
  isModalVisible: boolean;
  onCloseModal: () => void;
  isVisible?: boolean; // For autoplay control
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
  isVisible = true,
}: MediaPreviewProps) {
  // Track dimensions for each image to maintain proper aspect ratio
  const [imageDimensions, setImageDimensions] = useState<Record<number, { width: number, height: number }>>({});

  // Calculate appropriate dimensions when image loads
  const handleImageLoad = (index: number, width: number, height: number) => {
    setImageDimensions(prev => ({
      ...prev,
      [index]: { width, height }
    }));
  };

  // Calculate display width based on number of media items
  const getContainerWidth = () => {
    const containerWidth = media.length === 1 
      ? screenWidth - 16 // Full width (minus padding)
      : (screenWidth - 24) / 2; // Half width (minus padding and gap)
    
    return containerWidth;
  };

  // Calculate height based on image's aspect ratio with a maximum constraint
  const getImageHeight = (index: number) => {
    const dimensions = imageDimensions[index];
    if (!dimensions) return 200; // Default height until image loads
    
    const containerWidth = getContainerWidth();
    const aspectRatio = dimensions.width / dimensions.height;
    const calculatedHeight = containerWidth / aspectRatio;
    
    // Apply maximum height constraint
    return Math.min(calculatedHeight, MAX_IMAGE_HEIGHT);
  };

  // Calculate video height based on common aspect ratios
  const getVideoHeight = () => {
    const containerWidth = getContainerWidth();
    
    // Use a more flexible approach for videos
    // Default to a reasonable height that works for both portrait and landscape
    const defaultHeight = Math.min(containerWidth * 0.75, 300); // 4:3 aspect ratio, max 300px
    
    return defaultHeight;
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
              // Only set height for images and videos, embeds control their own height
              item.type === 'embed' ? {} : { height: item.type === 'video' ? getVideoHeight() : getImageHeight(index) }
            ]}
          >
            {item.type === 'video' ? (
              <VideoWithAutoplay 
                url={item.url} 
                isVisible={isVisible}
                style={styles.fullSize}
              />
            ) : item.type === 'embed' ? (
              <EmbedPlayer url={item.url} />
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
    borderRadius: theme.borderRadius.sm,
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