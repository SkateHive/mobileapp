import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, SafeAreaView, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '~/lib/theme';

interface GameEmbedProps {
  id: string; // game slug: 'quest-for-stoken' | 'lougnar'
}

const GAME_DATA: Record<string, { title: string; url: string; emoji: string }> = {
  'quest-for-stoken': {
    title: 'Quest for Stoken',
    url: 'https://quest-for-stoken.vercel.app/QFS/index.html',
    emoji: '🛹',
  },
  'lougnar': {
    title: 'Lougnar',
    url: 'https://quest-for-stoken.vercel.app/lougnar/index.html',
    emoji: '👹',
  },
};

export const GameEmbed = ({ id }: GameEmbedProps) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const game = GAME_DATA[id.toLowerCase()] || { 
    title: 'Unknown Game', 
    url: '', 
    emoji: '🎮' 
  };

  if (!game.url) return null;

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.card} 
        onPress={() => setIsModalVisible(true)}
      >
        <View style={styles.thumbnailContainer}>
          <Text style={styles.emoji}>{game.emoji}</Text>
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color={theme.colors.background} />
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{game.title}</Text>
          <Text style={styles.subtitle}>Tap to Play</Text>
        </View>
      </Pressable>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{game.title}</Text>
            <TouchableOpacity 
              onPress={() => setIsModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <WebView 
            source={{ uri: game.url }} 
            style={styles.webview}
            startInLoadingState={true}
            scalesPageToFit={true}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            injectedJavaScript={`
              const meta = document.createElement('meta');
              meta.setAttribute('name', 'viewport');
              meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
              document.getElementsByTagName('head')[0].appendChild(meta);
              document.body.style.overflow = 'hidden';
              true;
            `}
            renderLoading={() => (
              <View style={styles.loading}>
                <Text style={styles.loadingText}>Loading {game.title}...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(50, 205, 50, 0.05)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.green,
    overflow: 'hidden',
    height: 100,
  },
  thumbnailContainer: {
    width: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
  },
  playButton: {
    position: 'absolute',
    backgroundColor: theme.colors.green,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  info: {
    flex: 1,
    padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    marginBottom: 4,
  },
  subtitle: {
    color: theme.colors.green,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  headerTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
  },
  closeButton: {
    padding: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
    marginTop: 10,
  },
});
