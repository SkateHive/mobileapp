import type { Media, Post } from './types';
import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

// Simple utility to merge styles (replacement for cn function)
export function mergeStyles(...styles: any[]) {
  return styles.filter(Boolean).reduce((acc, style) => ({ ...acc, ...style }), {});
}

export function extractMediaFromBody(body: string): Media[] {
  const media: Media[] = [];

  // Extract images
  const imageMatches = body.match(/!\[.*?\]\((.*?)\)/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const url = match.match(/\((.*?)\)/)?.[1];
      if (url) media.push({ type: 'image', url });
    });
  }

  // Extract videos from iframes with IPFS links
  const iframeMatches = body.match(/<iframe.*?src="(.*?)".*?><\/iframe>/g);
  if (iframeMatches) {
    iframeMatches.forEach(match => {
      const url = match.match(/src="(.*?)"/)?.[1];
      if (url) {
        media.push({ type: 'video', url });
      }
    });
  }

  return media;
}