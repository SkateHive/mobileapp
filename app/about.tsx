import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '~/components/ui/text';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { MatrixRain } from '~/components/ui/loading-effects/MatrixRain';
import { theme } from '~/lib/theme';


export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <MatrixRain />
      <View style={styles.content}>
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.text}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Skatehive Community</Text>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Section title="🌍 What is Skatehive?">
            <Bullet text="It's a worldwide crew of skaters, creators, and weirdos doing it our way." />
            <Bullet text="Built on DIY, decentralization, and zero corporate bullsh*t." />
            <Bullet text="No bosses, no brands calling shots — this is 100% skater-owned, skater-run." />
          </Section>

          <Section title="📼 Tech Revolution in Skateboarding">
            <Bullet text="From VX tapes to IG clips — tech's always been part of the ride." />
            <Bullet text="Skatehive is the next chapter: community-powered + crypto rewards = freedom." />
          </Section>

          <Section title="🚀 Why It Rips">
            <Bullet text="Post-to-earn: film a trick, drop a story, share your vibe — get rewarded." />
            <Bullet text="Infinity Mag: our own never-ending skate mag. No ads. No fluff." />
            <Bullet text="Decentralized sponsorships: repping your crew, getting love from the people." />
          </Section>

          <Section title="🧰 Open-Source = Total Freedom">
            <Bullet text="Anyone can fork this sh*t — skateshops, collectives, your homie with a laptop." />
            <Bullet text="Your content echoes across the skateverse. Powered by blockchain, owned by you." />
          </Section>

          <Section title="🤝 Community-First, Always">
            <Bullet text="Likes, posts, comments — every move adds value to *our* world." />
            <Bullet text="We set the tone. No AI deciding what's cool. No engagement farms." />
          </Section>

          <Section title="🛹 Our Mission">
            <Bullet text="Put skate media back in skaters' hands. Forever." />
            <Bullet text="Grow a real-deal global skate culture — raw, connected, and free AF." />
          </Section>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync('https://docs.skatehive.app/docs/')}
              style={[styles.actionButton, styles.primaryActionButton]}
            >
              <Text style={styles.actionButtonText}>More Info</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[styles.actionButton, styles.secondaryActionButton]}
            >
              <Text style={styles.secondaryActionButtonText}>Close</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletText}>•</Text>
      <Text style={styles.bulletContent}>{text}</Text>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingTop: theme.spacing.xxxl + theme.spacing.sm, // Account for status bar
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    lineHeight: theme.fontSizes.xxl + theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.fontSizes.lg + theme.spacing.xs,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  bulletText: {
    fontSize: theme.fontSizes.md,
    lineHeight: theme.fontSizes.md + theme.spacing.xs,
    marginRight: theme.spacing.xs,
    color: theme.colors.primary,
    fontFamily: theme.fonts.regular,
  },
  bulletContent: {
    fontSize: theme.fontSizes.md,
    lineHeight: theme.fontSizes.md + theme.spacing.xs,
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  buttonContainer: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  actionButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryActionButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  secondaryActionButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButtonText: {
    color: theme.colors.background,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
  },
  secondaryActionButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
  },
});
