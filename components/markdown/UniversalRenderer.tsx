import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MarkdownProcessor } from '~/lib/markdown/MarkdownProcessor';
import { EmbedFactory } from './EmbedFactory';
import { theme } from '~/lib/theme';

interface UniversalRendererProps {
  content: string;
}

export const UniversalRenderer = ({ content }: UniversalRendererProps) => {
  const processed = useMemo(() => MarkdownProcessor.process(content), [content]);

  // Split by internal token placeholders
  const parts = useMemo(() => {
    return processed.contentWithPlaceholders.split(/(\[\[(?:YOUTUBE|VIMEO|ODYSEE|THREESPEAK|IPFSVIDEO|INSTAGRAM|ZORACOIN|SNAPSHOT|IMAGE):[^\]]+\]\])/g);
  }, [processed.contentWithPlaceholders]);

  const markdownStyles = StyleSheet.create({
    body: {
      color: theme.colors.text,
      fontFamily: theme.fonts.default,
      fontSize: theme.fontSizes.md,
      lineHeight: 22,
    },
    link: {
      color: theme.colors.green,
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: 'rgba(50, 205, 50, 0.05)',
      borderLeftColor: theme.colors.green,
      borderLeftWidth: 4,
      marginLeft: 0,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    code_inline: {
      backgroundColor: theme.colors.lightGray,
      color: theme.colors.text,
      fontFamily: theme.fonts.default,
      borderRadius: theme.borderRadius.xs,
      paddingHorizontal: 4,
    },
    code_block: {
      backgroundColor: theme.colors.lightGray,
      color: theme.colors.text,
      fontFamily: theme.fonts.default,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginVertical: theme.spacing.sm,
    },
    heading1: {
      color: theme.colors.text,
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.xl,
      marginVertical: theme.spacing.sm,
    },
    heading2: {
      color: theme.colors.text,
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.lg,
      marginVertical: theme.spacing.xs,
    },
    // Add more styles as needed
  });

  return (
    <View style={styles.container}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check if part is a token
        if (part.startsWith('[[') && part.endsWith(']]')) {
          return <EmbedFactory key={`embed-${index}`} token={part} />;
        }

        // Otherwise render as Markdown
        // We trim to avoid excessive gaps, but keep some structure
        const cleanedPart = part.trim();
        if (!cleanedPart) return null;

        return (
          <Markdown key={`md-${index}`} style={markdownStyles}>
            {cleanedPart}
          </Markdown>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
