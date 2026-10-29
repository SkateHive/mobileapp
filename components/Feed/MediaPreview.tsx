import React, { useState } from 'react';
import { Modal, Pressable, View, FlatList, Dimensions, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../ui/text';
import { VideoPlayer } from './VideoPlayer';
import { VideoWithAutoplay } from './VideoWithAutoplay';
import { EmbedPlayer } from './EmbedPlayer';
import type { Media } from '../../lib/types';
import { theme } from '../../lib/theme';

interface MediaPreviewProps {
  media: Media[];
  onMediaPress: (media: Media) => void;
  selectedMedia: Media | null;
  isModalVisible: boolean;
  onCloseModal: () => void;
  isVisible?: boolean; // For autoplay control
  thumbnailUrl?: string | null; // From post json_metadata.image[0]
}

// For calculating image dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAX_IMAGE_HEIGHT = screenHeight * 0.75;

// Swipeable carousel for posts with 2+ images. The first image sets the frame
// aspect ratio (Instagram-style); the others cover-fill it. Dots + an "N/M"
// counter show position, and tapping opens the full-screen viewer.
function ImageCarousel({
  images,
  onPress,
}: {
  images: Media[];
  onPress: (m: Media) => void;
}) {
  const [width, setWidth] = useState(screenWidth - 16);
  const [index, setIndex] = useState(0);
  const [aspect, setAspect] = useState(1); // width / height of the first image
  const height = Math.min(Math.max(width / aspect, width * 0.8), MAX_IMAGE_HEIGHT);

  return (
    <View
      style={[styles.carousel, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m, i) => `${m.url}-${i}`}
        snapToInterval={width}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => onPress(item)} style={{ width, height }}>
            <Image
              source={{ uri: item.url }}
              style={styles.fullSize}
              contentFit="cover"
              onLoad={
                i === 0
                  ? (ev) => {
                      const { width: w, height: h } = ev.source;
                      if (w && h) setAspect(w / h);
                    }
                  : undefined
              }
            />
          </Pressable>
        )}
      />
      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {index + 1}/{images.length}
        </Text>
      </View>
      <View style={styles.dots} pointerEvents="none">
        {images.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export function MediaPreview({
  media,
  onMediaPress,
  selectedMedia,
  isModalVisible,
  onCloseModal,
  isVisible = true,
  thumbnailUrl,
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

  const images = media.filter((m) => m.type === 'image');
  const others = media.filter((m) => m.type !== 'image');

  return (
    <>
      {/* Preview */}
      <View style={styles.container}>
        {/* Videos / embeds — always full-width, stacked */}
        {others.map((item, index) => (
          <View
            key={`o-${index}`}
            style={[
              styles.mediaContainer,
              styles.singleMedia,
              item.type === 'embed' ? {} : { height: getVideoHeight() },
            ]}
          >
            {item.type === 'video' && Platform.OS === 'android' && isVisible === false ? (
              // Android: a clip off screen shows its poster instead of holding
              // a player; many idle players filled the 256 MB Java heap.
              <View style={[styles.fullSize, styles.videoPoster]}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.fullSize} contentFit="cover" />
                ) : null}
              </View>
            ) : item.type === 'video' ? (
              <VideoWithAutoplay
                url={item.url}
                thumbnailUrl={thumbnailUrl}
                isVisible={isVisible}
                style={styles.fullSize}
              />
            ) : (
              <EmbedPlayer url={item.url} />
            )}
          </View>
        ))}

        {/* Images: single = full-width; multiple = swipeable carousel */}
        {images.length === 1 ? (
          <View
            style={[styles.mediaContainer, styles.singleMedia, { height: getImageHeight(0) }]}
          >
            <Pressable onPress={() => onMediaPress(images[0])} style={styles.fullSize}>
              <Image
                source={{ uri: images[0].url }}
                style={styles.fullSize}
                contentFit="cover"
                onLoad={(e) => {
                  const { width, height } = e.source;
                  handleImageLoad(0, width, height);
                }}
              />
            </Pressable>
          </View>
        ) : images.length > 1 ? (
          <ImageCarousel images={images} onPress={onMediaPress} />
        ) : null}
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
                contentFit="contain"
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
  fullSize: {
    width: '100%',
    height: '100%',
  },
  videoPoster: {
    backgroundColor: theme.colors.background,
  },
  carousel: {
    width: '100%',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted,
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: theme.fonts.bold,
  },
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 7,
    height: 7,
    borderRadius: 3.5,
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