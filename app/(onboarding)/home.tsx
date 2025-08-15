import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '~/components/ui/text';
import { Button } from '~/components/ui/button';
import { router } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { theme } from '~/lib/theme';


const handleCloseScreen = () => {
  router.push('/(tabs)/profile');
};


export default function WaitlistScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCloseScreen}>
            <Ionicons
              name="close-outline"
              size={24}
              color='#ffffff'
            />
          </Pressable>
          <Pressable>
            <Text style={styles.closeText}>
              Close
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.mainContent}>
          <Ionicons
            name="enter-outline"
            size={100}
            color='#ffffff'
          />

          <View style={styles.textSection}>
            <Text style={styles.title}>
              How to Join SkateHive
            </Text>
            <Text style={styles.description}>
              Skatehive is a global community that unites skaters, content creators, and enthusiasts to share, learn, and collaborate.
            </Text>
          </View>

          <View style={styles.videoContainer}>
            <VideoPlayer
              url={'https://ipfs.skatehive.app/ipfs/QmYuM1h51bddDuC44FoAQYp9FRF2CghCncULeS4T3bp727'}
              playing={false}
            />
          </View>

          <View style={styles.nextStepSection}>
            <Text style={styles.nextStepTitle}>
              Take the next step in this evolution
            </Text>
          </View>

          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>
              Find us
            </Text>
            <View style={styles.socialIcons}>
              <FontAwesome name="twitter" size={40} color="#1DA1F2" />
              <FontAwesome name="instagram" size={40} color="#E4405F" />
              <FontAwesome name="github" size={40} color="#333" />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    fontFamily: theme.fonts.bold,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSection: {
    marginTop: theme.spacing.xxl,
  },
  title: {
    fontSize: 36,
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
    color: theme.colors.text,
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.7,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.xxl,
  },
  nextStepSection: {
    marginTop: theme.spacing.xxl,
  },
  nextStepTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
    color: theme.colors.text,
  },
  socialSection: {
    marginTop: theme.spacing.xxl,
  },
  socialTitle: {
    fontSize: 36,
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
    color: theme.colors.text,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
});