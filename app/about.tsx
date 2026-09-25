import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '~/components/ui/text';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AuthBackground } from '~/components/auth/AuthBackground';
import { useToast } from '~/lib/toast-provider';
import { theme } from '~/lib/theme';
import { t } from '~/lib/i18n';

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
        accessibilityLabel={t('common.go_back')}
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.white} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('auth.about.title')}</Text>

        <Section title={t('auth.about.what_title')}>
          <Bullet text={t('auth.about.what_1')} />
          <Bullet text={t('auth.about.what_2')} />
          <Bullet text={t('auth.about.what_3')} />
        </Section>

        <Section title={t('auth.about.account_title')}>
          <Bullet text={t('auth.about.account_1')} />
          <Bullet text={t('auth.about.account_3')} />
        </Section>

        <Section title={t('auth.about.own_account_title')}>
          <Bullet text={t('auth.about.own_account_1')} />
          <Bullet text={t('auth.about.own_account_2')} />
          <Bullet text={t('auth.about.own_account_3')} />
        </Section>

        <Section title={t('auth.about.tech_title')}>
          <Bullet text={t('auth.about.tech_1')} />
          <Bullet text={t('auth.about.tech_2')} />
        </Section>

        <Section title={t('auth.about.why_title')}>
          <Bullet text={t('auth.about.why_1')} />
          <Bullet text={t('auth.about.why_2')} />
          <Bullet text={t('auth.about.why_3')} />
        </Section>

        <Section title={t('auth.about.open_title')}>
          <Bullet text={t('auth.about.open_1')} />
          <Bullet text={t('auth.about.open_2')} />
        </Section>

        <Section title={t('auth.about.community_title')}>
          <Bullet text={t('auth.about.community_1')} />
          <Bullet text={t('auth.about.community_2')} />
        </Section>

        <Section title={t('auth.about.mission_title')}>
          <Bullet text={t('auth.about.mission_1')} />
          <Bullet text={t('auth.about.mission_2')} />
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
