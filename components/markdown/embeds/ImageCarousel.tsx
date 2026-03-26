import React from 'react';
import { StyleSheet, View, FlatList, Dimensions, Text } from 'react-native';
import { ImageEmbed } from './ImageEmbed';
import { theme } from '~/lib/theme';

interface ImageCarouselProps {
  urls: string[];
}

const { width: screenWidth } = Dimensions.get('window');

export const ImageCarousel = ({ urls }: ImageCarouselProps) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [containerWidth, setContainerWidth] = React.useState(screenWidth);

  if (!urls || urls.length === 0) return null;
  if (urls.length === 1) return <ImageEmbed url={urls[0]} />;

  return (
    <View 
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <FlatList
        data={urls}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <View style={[styles.imageWrapper, { width: containerWidth }]}>
            <ImageEmbed url={item} />
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
          setActiveIndex(index);
        }}
        getItemLayout={(_, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index,
        })}
      />
      <View style={styles.indicatorContainer}>
        {urls.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === activeIndex ? styles.activeIndicator : styles.inactiveIndicator,
            ]}
          />
        ))}
      </View>
      <View style={styles.counter}>
        <Text style={styles.counterText}>{activeIndex + 1} / {urls.length}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  imageWrapper: {
    // Width set dynamically
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeIndicator: {
    backgroundColor: theme.colors.green,
    width: 12,
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: theme.fonts.bold,
  },
});
