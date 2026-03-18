import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MarkdownProcessor } from '~/lib/markdown/MarkdownProcessor';
import { EmbedFactory } from './EmbedFactory';
import { theme } from '~/lib/theme';

interface UniversalRendererProps {
  content: string;
  isVisible?: boolean;
}

export const UniversalRenderer = ({ content, isVisible }: UniversalRendererProps) => {
  const processed = useMemo(() => MarkdownProcessor.process(content), [content]);

  // Split by internal token placeholders [[TYPE:ID]]
  const parts = useMemo(() => {
    return processed.contentWithPlaceholders.split(/(\s*\[\[[A-Z]+:[^\]]+\]\]\s*)/g);
  }, [processed.contentWithPlaceholders]);

  const markdownStyles = useMemo(() => StyleSheet.create({
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
    image: {
      width: '100%',
      height: 200,
      borderRadius: theme.borderRadius.md,
    }
  }), []);

  // Simple hash for stable keys
  const getStableKey = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `part-${hash}`;
  };

  // Create renderable items by grouping consecutive text parts
  const renderItems = useMemo(() => {
    const items: { type: 'token' | 'markdown'; content: string; key: string }[] = [];
    let currentMarkdown = '';

    parts.forEach((part, index) => {
      if (!part) return;
      
      const trimmedPart = part.trim();
      if (trimmedPart.startsWith('[[') && trimmedPart.endsWith(']]')) {
        // If we have accumulated markdown, push it first
        if (currentMarkdown.length > 0) {
          items.push({
            type: 'markdown',
            content: currentMarkdown,
            key: `md-${index}-${getStableKey(currentMarkdown)}`
          });
          currentMarkdown = '';
        }
        // Push the token
        items.push({
          type: 'token',
          content: trimmedPart,
          key: `token-${index}-${getStableKey(trimmedPart)}`
        });
      } else {
        // Accumulate text/markdown including whitespace
        currentMarkdown += part;
      }
    });

    // Push any remaining markdown
    if (currentMarkdown.length > 0) {
      items.push({
        type: 'markdown',
        content: currentMarkdown,
        key: `md-final-${getStableKey(currentMarkdown)}`
      });
    }

    return items;
  }, [parts, getStableKey]);

  return (
    <View style={styles.container}>
      {renderItems.map((item) => {
        if (item.type === 'token') {
          return <EmbedFactory key={item.key} token={item.content} isVisible={isVisible} />;
        }
        return (
          <Markdown key={item.key} style={markdownStyles}>
            {item.content}
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
