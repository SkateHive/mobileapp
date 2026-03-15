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
  const [aspectRatio, setAspectRatio] = React.useState(16 / 9);
  const [isModalVisible, setIsModalVisible] = React.useState(false);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setIsModalVisible(true)}>
        <Image
          source={{ uri: url }}
          style={[styles.image, { aspectRatio }]}
          contentFit="cover"
          transition={200}
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
    backgroundColor: theme.colors.muted,
  },
  image: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
  }
});
