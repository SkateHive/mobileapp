import React from 'react';
import { UniversalRenderer } from './UniversalRenderer';

interface EnhancedMarkdownRendererProps {
  content: string;
}

/**
 * @deprecated Use UniversalRenderer directly if possible.
 * This component is kept for backward compatibility and now uses the new modular system.
 */
export function EnhancedMarkdownRenderer({ content }: EnhancedMarkdownRendererProps) {
  return <UniversalRenderer content={content} />;
}
