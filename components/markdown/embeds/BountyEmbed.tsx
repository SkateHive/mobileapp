import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '~/lib/theme';

interface BountyEmbedProps {
  id: string; // Format: "chainId:bountyId"
}

export const BountyEmbed = ({ id }: BountyEmbedProps) => {
  const [chainId, bountyId] = id.split(':');
  
  const bountyUrl = `https://skatehive.app/bounties/poidh/${chainId}/${bountyId}`;

  const handlePress = () => {
    Linking.openURL(bountyUrl).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.card} onPress={handlePress}>
        <View style={styles.header}>
          <Text style={styles.badge}>💰 POIDH BOUNTY</Text>
          <Text style={styles.chainId}>Chain ID: {chainId}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Bounty #{bountyId}</Text>
          <Text style={styles.description} numberOfLines={2}>
            Tapping will take you to the full bounty and claim on the SkateHive webapp.
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.linkText}>View Bounty</Text>
          <Ionicons name="open-outline" size={16} color={theme.colors.green} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
    width: '100%',
  },
  card: {
    backgroundColor: 'rgba(50, 205, 50, 0.05)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.green,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    color: theme.colors.green,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
    letterSpacing: 1,
  },
  chainId: {
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.xs,
    opacity: 0.6,
  },
  content: {
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  description: {
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    opacity: 0.8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  linkText: {
    color: theme.colors.green,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
  },
});
