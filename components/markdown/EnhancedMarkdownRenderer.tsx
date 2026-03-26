import React from 'react';
import { UniversalRenderer } from './UniversalRenderer';

interface EnhancedMarkdownRendererProps {
  content: string;
  isVisible?: boolean;
  isPrefetch?: boolean;
  author?: string;
  onPress?: () => void;
}

/**
 * @deprecated Use UniversalRenderer directly if possible.
 * This component is kept for backward compatibility and now uses the new modular system.
 */
export function EnhancedMarkdownRenderer({ content, isVisible, isPrefetch, author, onPress }: EnhancedMarkdownRendererProps) {
  return <UniversalRenderer content={content} isVisible={isVisible} isPrefetch={isPrefetch} author={author} onPress={onPress} />;
}
