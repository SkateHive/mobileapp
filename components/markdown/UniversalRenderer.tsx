import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MarkdownProcessor } from '~/lib/markdown/MarkdownProcessor';
import { EmbedFactory } from './EmbedFactory';
import { theme } from '~/lib/theme';
import { Image } from 'expo-image';
import { ImageCarousel } from './embeds/ImageCarousel';

interface UniversalRendererProps {
  content: string;
  isVisible?: boolean;
  onPress?: () => void;
}

export const UniversalRenderer = ({ content, isVisible, onPress }: UniversalRendererProps) => {
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
      marginTop: 0,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8, // Rhythm
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
      marginVertical: theme.spacing.sm,
    }
  }), []);

  const markdownRules = useMemo(() => ({
    image: (node: any) => {
      const { src, alt } = node.attributes;
      return (
        <Image
          key={node.key}
          source={{ uri: src }}
          style={markdownStyles.image}
          contentFit="cover"
          accessibilityLabel={alt}
        />
      );
    },
  }), [markdownStyles]);

  // Simple hash for stable keys
  const getStableKey = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `part-${hash}`;
  };

  // Create renderable items by grouping consecutive text parts and consecutive images
  const renderItems = useMemo(() => {
    const items: { type: 'token' | 'markdown' | 'carousel'; content: string | string[]; key: string }[] = [];
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

        // Check for IMAGE token
        const imageMatch = trimmedPart.match(/^\[\[(?:IMAGE|IAMGE):([^\]]+)\]\]$/i);
        if (imageMatch) {
          const imageUrl = imageMatch[1].trim();
          const lastItem = items[items.length - 1];

          if (lastItem && lastItem.type === 'carousel') {
            (lastItem.content as string[]).push(imageUrl);
          } else {
            items.push({
              type: 'carousel',
              content: [imageUrl],
              key: `carousel-${index}-${getStableKey(imageUrl)}`
            });
          }
        } else {
          // Push other tokens normally
          items.push({
            type: 'token',
            content: trimmedPart,
            key: `token-${index}-${getStableKey(trimmedPart)}`
          });
        }
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
          return <EmbedFactory key={item.key} token={item.content as string} isVisible={isVisible} />;
        }
        if (item.type === 'carousel') {
          return <ImageCarousel key={item.key} urls={item.content as string[]} />;
        }
        return (
          <Pressable 
            key={item.key} 
            onPress={onPress}
            // Ensure Pressable doesn't have an opaque background or border that blocks touches
            style={{ width: '100%' }}
          >
            <Markdown style={markdownStyles} rules={markdownRules}>
              {item.content as string}
            </Markdown>
          </Pressable>
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
