import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '~/lib/theme';

export interface ProcessedMarkdown {
  originalContent: string;
  processedContent: string;
  contentWithPlaceholders: string;
  hasInstagramEmbeds: boolean;
  videoPlaceholders: VideoPlaceholder[];
}

export interface VideoPlaceholder {
  type: 'VIDEO' | 'ODYSEE' | 'YOUTUBE' | 'VIMEO' | 'ZORACOIN';
  id: string;
  placeholder: string;
}

interface EnhancedMarkdownRendererProps {
  content: string;
}

export function EnhancedMarkdownRenderer({
  content,
}: EnhancedMarkdownRendererProps) {
  
  const processedMarkdown = useMemo(() => {
    return MarkdownProcessor.process(content);
  }, [content]);

  const renderedContent = useMemo(() => {
    return renderContentWithVideos(processedMarkdown);
  }, [processedMarkdown]);

  const styles = StyleSheet.create({
    container: {
      width: '100%',
    },
  });

  return <View style={styles.container}>{renderedContent}</View>;
}

// Simple MarkdownProcessor class for React Native
class MarkdownProcessor {
  static process(content: string): ProcessedMarkdown {
    // For now, use the basic markdown renderer
    const processedContent = content;
    const contentWithPlaceholders = content;
    const hasInstagramEmbeds = content.includes('instagram.com');
    const videoPlaceholders: VideoPlaceholder[] = [];

    return {
      originalContent: content,
      processedContent,
      contentWithPlaceholders,
      hasInstagramEmbeds,
      videoPlaceholders,
    };
  }
}

function renderContentWithVideos(
  processed: ProcessedMarkdown
): React.ReactNode[] {
  const styles = StyleSheet.create({
    // Blockquote styles
    quoteContainer: {
      flexDirection: 'row',
      marginVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.sm,
    },
    quoteBorder: {
      width: 3,
      backgroundColor: theme.colors.green,
      marginRight: theme.spacing.sm,
      borderRadius: 2,
    },
    quoteText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.text,
      fontStyle: 'italic',
      flex: 1,
      fontFamily: theme.fonts.default,
    },
    // Header styles
    h1Text: {
      fontSize: theme.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginVertical: theme.spacing.sm,
      fontFamily: theme.fonts.bold,
    },
    h2Text: {
      fontSize: theme.fontSizes.lg,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginVertical: theme.spacing.xs,
      fontFamily: theme.fonts.bold,
    },
    h3Text: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginVertical: theme.spacing.xs,
      fontFamily: theme.fonts.bold,
    },
    // Text formatting styles
    boldText: {
      fontWeight: 'bold',
      fontSize: theme.fontSizes.md,
      fontFamily: theme.fonts.bold,
    },
    italicText: {
      fontStyle: 'italic',
      fontSize: theme.fontSizes.md,
    },
    contentText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.text,
      lineHeight: 20,
      fontFamily: theme.fonts.default,
    },
    // Link styles
    linkText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.green,
      textDecorationLine: 'underline',
    },
    // Code styles
    codeText: {
      fontFamily: theme.fonts.default,
      fontSize: theme.fontSizes.sm,
      backgroundColor: theme.colors.lightGray,
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.xs,
    },
    codeBlock: {
      fontFamily: theme.fonts.default,
      fontSize: theme.fontSizes.sm,
      backgroundColor: theme.colors.lightGray,
      color: theme.colors.text,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginVertical: theme.spacing.sm,
    },
  });

  // Split content into lines and process each line
  const lines = processed.contentWithPlaceholders.split('\n');
  const renderedLines: React.ReactNode[] = [];
  
  lines.forEach((line, lineIndex) => {
    // Handle blockquotes (lines starting with >)
    if (line.trim().startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      renderedLines.push(
        <View key={`quote-${lineIndex}`} style={styles.quoteContainer}>
          <View style={styles.quoteBorder} />
          <Text style={styles.quoteText}>{quoteText}</Text>
        </View>
      );
    }
    // Handle headers (lines starting with #)
    else if (line.trim().startsWith('#')) {
      const headerLevel = line.match(/^#+/)?.[0].length || 1;
      const headerText = line.replace(/^#+\s*/, '');
      const headerStyle = headerLevel === 1 ? styles.h1Text : 
                         headerLevel === 2 ? styles.h2Text : styles.h3Text;
      renderedLines.push(
        <Text key={`header-${lineIndex}`} style={headerStyle}>{headerText}</Text>
      );
    }
    // Handle code blocks (lines with ``` or starting with 4 spaces)
    else if (line.trim().startsWith('```') || line.startsWith('    ')) {
      const codeText = line.replace(/^```|```$/g, '').replace(/^    /, '');
      if (codeText.trim()) {
        renderedLines.push(
          <Text key={`code-${lineIndex}`} style={styles.codeBlock}>{codeText}</Text>
        );
      }
    }
    // Handle bold text (**text**)
    else if (line.includes('**')) {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      renderedLines.push(
        <Text key={`line-${lineIndex}`} style={styles.contentText}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              return <Text key={`bold-${partIndex}`} style={styles.boldText}>{boldText}</Text>;
            }
            return <Text key={`normal-${partIndex}`}>{part}</Text>;
          })}
        </Text>
      );
    }
    // Handle italic text (*text*)
    else if (line.includes('*') && !line.includes('**')) {
      const parts = line.split(/(\*.*?\*)/g);
      renderedLines.push(
        <Text key={`line-${lineIndex}`} style={styles.contentText}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('*') && part.endsWith('*') && !part.includes('**')) {
              const italicText = part.slice(1, -1);
              return <Text key={`italic-${partIndex}`} style={styles.italicText}>{italicText}</Text>;
            }
            return <Text key={`normal-${partIndex}`}>{part}</Text>;
          })}
        </Text>
      );
    }
    // Handle inline code (`text`)
    else if (line.includes('`') && !line.includes('```')) {
      const parts = line.split(/(`.*?`)/g);
      renderedLines.push(
        <Text key={`line-${lineIndex}`} style={styles.contentText}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              const codeText = part.slice(1, -1);
              return <Text key={`code-${partIndex}`} style={styles.codeText}>{codeText}</Text>;
            }
            return <Text key={`normal-${partIndex}`}>{part}</Text>;
          })}
        </Text>
      );
    }
    // Regular text
    else if (line.trim()) {
      // Handle URLs in the text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);
      
      if (parts.length > 1) {
        renderedLines.push(
          <Text key={`line-${lineIndex}`} style={styles.contentText}>
            {parts.map((part, partIndex) => {
              if (urlRegex.test(part)) {
                return <Text key={`link-${partIndex}`} style={styles.linkText}>{part}</Text>;
              }
              return <Text key={`text-${partIndex}`}>{part}</Text>;
            })}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={`line-${lineIndex}`} style={styles.contentText}>{line}</Text>
        );
      }
    }
    // Empty line (add spacing)
    else {
      renderedLines.push(
        <View key={`space-${lineIndex}`} style={{ height: 8 }} />
      );
    }
  });
  
  return renderedLines;
}
