import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '~/lib/theme';

interface ProposalEmbedProps {
  url: string; // Full URL e.g. 'https://www.gnars.com/proposals/118'
}

export const ProposalEmbed = ({ url }: ProposalEmbedProps) => {
  // Simple extraction of ID and domain for display
  const match = url.match(/https?:\/\/(?:www\.)?([^\/\s]+)\/(?:proposals|vote)\/(\d+)/i);
  const domain = match ? match[1] : 'DAO';
  const id = match ? match[2] : '';

  const handlePress = () => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.card} onPress={handlePress}>
        <View style={styles.header}>
          <Text style={styles.daoName}>🏛️ {domain.split('.')[0].toUpperCase()}</Text>
          <Text style={styles.proposalId}>#{id}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Governance Proposal</Text>
          <Text style={styles.description} numberOfLines={2}>
            Tapping will take you to the full proposal and voting on {domain}.
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.linkText}>View Proposal</Text>
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
  daoName: {
    color: theme.colors.green,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.sm,
    letterSpacing: 1,
  },
  proposalId: {
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    opacity: 0.7,
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
