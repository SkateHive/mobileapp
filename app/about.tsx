import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '~/components/ui/text';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AuthBackground } from '~/components/auth/AuthBackground';
import { useToast } from '~/lib/toast-provider';
import { theme } from '~/lib/theme';

/**
 * What SkateHive is — reached from the info button on the login screen.
 *
 * Shares that screen's treatment (#60): the same collage, the same scrim, the
 * same floating back control. It used to be Matrix rain behind a large green
 * heading, which read as a different app to anyone arriving from the login.
 */
export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <AuthBackground scrim="top" />

      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.white} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Skatehive Community</Text>

        <Section title="🌍 What is Skatehive?">
          <Bullet text="It's a worldwide crew of skaters, creators, and weirdos doing it our way." />
          <Bullet text="Built on DIY, decentralization, and zero corporate bullsh*t." />
          <Bullet text="No bosses, no brands calling shots — this is 100% skater-owned, skater-run." />
        </Section>

        <Section title="🐝 Your account, explained">
          <Bullet text="You start with a lite account: post, comment and vote from day one, with no crypto setup at all." />
          <Bullet text="Your posts are real posts on the Hive blockchain — they just go out through @skatehive, the community account, instead of one of your own." />
          <Bullet text="A few things need an account in your name: following people, editing your profile, and earning rewards directly." />
        </Section>

        <Section title="🛹 Your own account, once you post">
          <Bullet text="Post your first clip and the crew sponsors a Hive account in your name. Your keys reach you by email, and the app links them to your login for you." />
          <Bullet text="Nothing to buy, nothing to set up, no form to fill. Skate, post, and the account follows." />
          <Bullet text="Already have a Hive account? Use 'Sign in with Hive' on the login screen — the posting key is all it ever asks for." />
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
      </ScrollView>
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
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 18,
    zIndex: 10,
  },
  content: {
    paddingTop: 62,
    paddingHorizontal: 24,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    textAlign: 'center',
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.auth.neon,
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  bulletMark: {
    color: theme.auth.neon,
    fontFamily: theme.fonts.default,
    fontSize: 13,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    color: theme.auth.textLight,
    fontFamily: theme.fonts.default,
    fontSize: 13,
    lineHeight: 20,
  },
  links: {
    gap: theme.spacing.sm,
  },
  linkButton: {
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.auth.neon,
    backgroundColor: theme.auth.surface,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  linkButtonPressed: { backgroundColor: theme.auth.neonPressed },
  linkButtonText: {
    color: theme.auth.neon,
    fontFamily: theme.fonts.bold,
    fontSize: 13,
  },
});
