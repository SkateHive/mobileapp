import React from 'react';
import { MediaProvider } from './BaseProvider';
import { ImageEmbed } from '~/components/markdown/embeds/ImageEmbed';

export const ImageProvider: MediaProvider = {
  name: 'IMAGE',
  patterns: [
    /<center>\s*!\[.*?\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)(?:\s+["'].*?["'])?\)\s*<\/center>/gi,
    /!\[.*?\]\((https?:\/\/(?:gateway\.pinata\.cloud|ipfs\.skatehive\.app)\/ipfs\/([\w-]+)(\.[a-zA-Z0-9]+)?)(?:\s+["'].*?["'])?\)/gi,
    /!\[.*?\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*\.(?:gif|jpg|jpeg|png|webp|heic|JPG|JPEG|PNG|GIF|WEBP|HEIC)(?:\?[^\s)]*)?)(?:\s+["'].*?["'])?\)/gi,
    /(?:^|\s)(https?:\/\/[a-zA-Z0-9._\-/()]+(?:\([a-zA-Z0-9._\-/()]+\)[a-zA-Z0-9._\-/()]*)*\.(?:gif|jpg|jpeg|png|webp|heic|JPG|JPEG|PNG|GIF|WEBP|HEIC)(?:\?[^\s]*)?)(?=\s|$)/gmi
  ],
  resolve: (match: string) => {
    // Extract the URL from different formats
    // Updated to handle parentheses within the URL itself
    const markdownMatch = match.match(/!\[.*?\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)(?:\s+["'].*?["'])?\)/);
    if (markdownMatch) return markdownMatch[1];
    
    const urlMatch = match.match(/(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[1] : match.trim();
  },
  Component: ({ id, isVisible }: { id: string; isVisible?: boolean }) => {
    return <ImageEmbed url={id} />;
  }
};
