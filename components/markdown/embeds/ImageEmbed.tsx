import React from 'react';
import { StyleSheet, Pressable, View, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '~/lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface ImageEmbedProps {
  url: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ImageEmbed = ({ url }: ImageEmbedProps) => {
  const [aspectRatio, setAspectRatio] = React.useState<number>(1.0); // Predictable initial
  const [isModalVisible, setIsModalVisible] = React.useState(false);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setIsModalVisible(true)}>
        <Image
          source={{ uri: url }}
          style={[
            styles.image, 
            { aspectRatio: aspectRatio }
          ]}
          contentFit="cover"
          transition={0} // Disable transition to stop flickering
          cachePolicy="memory-disk"
          onLoad={(e) => {
            if (e.source.width && e.source.height) {
              setAspectRatio(e.source.width / e.source.height);
            }
          }}
        />
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.closeButton} 
            onPress={() => setIsModalVisible(false)}
          >
            <Ionicons name="close" size={32} color="white" />
          </Pressable>
          
          <Image
            source={{ uri: url }}
            style={styles.fullImage}
            contentFit="contain"
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle placeholder
  },
  image: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  }
});
