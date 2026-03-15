import React from 'react';
import { UniversalRenderer } from './UniversalRenderer';

interface EnhancedMarkdownRendererProps {
  content: string;
  isVisible?: boolean;
  onPress?: () => void;
}

/**
 * @deprecated Use UniversalRenderer directly if possible.
 * This component is kept for backward compatibility and now uses the new modular system.
 */
export function EnhancedMarkdownRenderer({ content, isVisible, onPress }: EnhancedMarkdownRendererProps) {
  return <UniversalRenderer content={content} isVisible={isVisible} onPress={onPress} />;
}
