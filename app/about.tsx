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
          <Text style={styles.headerTitle}>Skatehive Revolution</Text>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Section title="🛹 What is Skatehive?">
            <Bullet text="Skatehive is the portal to a decentralized skate culture. Built on the Hive blockchain, it's where skaters own their content and their community." />
          </Section>

          <Section title="💎 True Ownership">
            <Bullet text="Every clip, photo, and story you post is yours. No corporate middleman can delete your history or sell your data." />
            <Bullet text="Your account is your identity. You own the keys, you own the vibe." />
          </Section>

          <Section title="🌐 Decentralization">
            <Bullet text="No bosses, no algorithms, no censorship. Skatehive is powered by a global network of nodes, not a boardroom." />
            <Bullet text="DIY at its purest: community-driven moderation and development." />
          </Section>

          <Section title="💰 Earn Rewards">
            <Bullet text="Post-to-Earn: The community votes on what rips, and you get rewarded in crypto (HIVE/HBD) for your contributions." />
            <Bullet text="Your engagement adds value to the ecosystem, and you get a piece of the pie." />
          </Section>

          <Section title="🛠️ Built by the Homies">
            <Bullet text="@xvlad - Founder & Visionary" />
            <Bullet text="@vaipraonde - Lead Dev & Code Shredder" />
            <Bullet text="@r4topunk - Blockchain Wizard" />
            <Bullet text="@mengao - Community Architect" />
            <Bullet text="@webgnar - Creative Director" />
          </Section>

          <Section title="📖 Open Source">
            <Bullet text="This app is 100% open-source. Anyone can contribute, fork, or build the next iteration of skate media." />
          </Section>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync('https://docs.skatehive.app/docs/')}
              style={[styles.actionButton, styles.primaryActionButton]}
            >
              <Text style={styles.actionButtonText}>Read the Docs</Text>
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
