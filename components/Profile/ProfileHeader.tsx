import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "~/lib/theme";

// Map common country names/codes to flag emojis
function countryToFlag(location: string): string {
  const loc = location.trim().toUpperCase();
  const map: Record<string, string> = {
    BR: '🇧🇷', BRAZIL: '🇧🇷', BRASIL: '🇧🇷',
    US: '🇺🇸', USA: '🇺🇸', 'UNITED STATES': '🇺🇸',
    UK: '🇬🇧', GB: '🇬🇧', 'UNITED KINGDOM': '🇬🇧', ENGLAND: '🇬🇧',
    DE: '🇩🇪', GERMANY: '🇩🇪', DEUTSCHLAND: '🇩🇪',
    FR: '🇫🇷', FRANCE: '🇫🇷',
    ES: '🇪🇸', SPAIN: '🇪🇸', ESPAÑA: '🇪🇸',
    PT: '🇵🇹', PORTUGAL: '🇵🇹',
    MX: '🇲🇽', MEXICO: '🇲🇽', MÉXICO: '🇲🇽',
    CA: '🇨🇦', CANADA: '🇨🇦',
    AR: '🇦🇷', ARGENTINA: '🇦🇷',
    AU: '🇦🇺', AUSTRALIA: '🇦🇺',
    JP: '🇯🇵', JAPAN: '🇯🇵',
    NL: '🇳🇱', NETHERLANDS: '🇳🇱',
    IT: '🇮🇹', ITALY: '🇮🇹', ITALIA: '🇮🇹',
    CL: '🇨🇱', CHILE: '🇨🇱',
    CO: '🇨🇴', COLOMBIA: '🇨🇴',
    PE: '🇵🇪', PERU: '🇵🇪',
    VE: '🇻🇪', VENEZUELA: '🇻🇪',
    SE: '🇸🇪', SWEDEN: '🇸🇪',
    NO: '🇳🇴', NORWAY: '🇳🇴',
    CR: '🇨🇷', 'COSTA RICA': '🇨🇷',
    ZA: '🇿🇦', 'SOUTH AFRICA': '🇿🇦',
    IN: '🇮🇳', INDIA: '🇮🇳',
    PH: '🇵🇭', PHILIPPINES: '🇵🇭',
  };
  // Exact match first. Then country names can match anywhere in the string, so
  // "Sao Paulo, Brazil" works, while two-letter codes have to be a word of their
  // own: as plain substrings they hit half the map by accident. MOROCCO contains
  // CO, SENEGAL contains SE, CHINA contains IN. Splitting on non-letters keeps
  // "SP, BR" working without that.
  if (map[loc]) return map[loc];
  const words = loc.split(/[^A-Z]+/);
  for (const [key, flag] of Object.entries(map)) {
    const found = key.length > 2 ? loc.includes(key) : words.includes(key);
    if (found) return flag;
  }
  return '🌍';
}

/** A cell of the stats card. Without onPress it renders flat, not disabled. */
export interface ProfileStat {
  value: string | number;
  label: string;
  onPress?: () => void;
}

interface ProfileHeaderProps {
  /** The avatar itself: a lite account's picture comes from SkateHive's server
      and a Hive one from the CDN, with different fallbacks, so the caller
      renders it and this only places it. */
  avatar: React.ReactNode;
  displayName: string;
  /** Rendered with the @ prefix. */
  handle: string;
  location?: string;
  bio?: string;
  /** Already formatted ("0 HP", "412 HP"). Null hides the chip entirely, which
      is what a Hive profile wants while HP is still resolving. */
  hpLabel?: string | null;
  onHpPress?: () => void;
  /** Sits at the end of the name row: the gear on your own profile. */
  trailingAction?: React.ReactNode;
  stats: [ProfileStat, ProfileStat, ProfileStat];
  /** Below the stats card: the follow button on someone else's profile. */
  footer?: React.ReactNode;
}

/**
 * The top of the profile screen: avatar, name row, stats card.
 *
 * Lite (email) accounts and Hive accounts show the same header with different
 * contents, and used to do it through two copies of this markup in
 * `profile.tsx`. Changing one and not the other was silent, since both still
 * rendered (#70).
 */
export function ProfileHeader({
  avatar,
  displayName,
  handle,
  location,
  bio,
  hpLabel,
  onHpPress,
  trailingAction,
  stats,
  footer,
}: ProfileHeaderProps) {
  return (
    <View style={styles.profileSection}>
      <View style={styles.profileHeaderRow}>
        <View style={styles.profileImageContainer}>{avatar}</View>

        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            {trailingAction}
          </View>

          {/* Handle, with country inline. Two lines because a long handle plus
              a long country ("UNITED KINGDOM") would otherwise clip the country
              away entirely — the column is already narrowed by the avatar. */}
          <Text style={styles.username} numberOfLines={2}>
            @{handle}
            {!!location && (
              <Text style={styles.username}>
                {"  ·  "}
                {countryToFlag(location)} {location}
              </Text>
            )}
          </Text>

          {/* Trimmed: bios routinely carry a trailing newline, which renders
              as an empty second line. */}
          {!!bio?.trim() && (
            <Text style={styles.bio} numberOfLines={2}>
              {bio.trim()}
            </Text>
          )}

          {/* Hive Power. The design asked for an "earned" figure, which nothing
              exposes; HP is a real number the app already trusts elsewhere. */}
          {!!hpLabel && (
            <Pressable
              style={styles.hpChip}
              onPress={onHpPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${hpLabel}. What is this?`}
            >
              <Text style={styles.hpChipText}>{hpLabel}</Text>
              <Ionicons
                name="information-circle-outline"
                size={12}
                color={theme.colors.muted}
              />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.statsCard}>
        {stats.map((stat, i) => {
          const Cell = stat.onPress ? Pressable : View;
          return (
            <Cell
              key={stat.label}
              style={[styles.statCell, i === 1 && styles.statCellMiddle]}
              onPress={stat.onPress}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Cell>
          );
        })}
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  profileImageContainer: {
    // No need for alignSelf since it's in a row now
  },
  nameSection: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    lineHeight: theme.fontSizes.xl * 1.2,
  },
  username: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  bio: {
    color: theme.colors.white,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    lineHeight: 18,
    opacity: 0.8,
  },
  hpChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: theme.spacing.xxs,
  },
  hpChipText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.xxs,
    color: theme.colors.primary,
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 10,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statCellMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  statLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xxs,
  },
});
