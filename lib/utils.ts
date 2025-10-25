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

  // Extract videos from iframes
  const iframeMatches = body.match(/<iframe.*?src="(.*?)".*?><\/iframe>/g);
  if (iframeMatches) {
    iframeMatches.forEach(match => {
      const url = match.match(/src="(.*?)"/)?.[1];
      if (url) {
        // Check if it's a direct video URL (IPFS, mp4, webm, m3u8)
        // These can be played with expo-video
        const isDirectVideo = url.includes('ipfs') || 
                             url.includes('.mp4') || 
                             url.includes('.webm') || 
                             url.includes('.m3u8');
        
        if (isDirectVideo) {
          media.push({ type: 'video', url });
        } else {
          // It's a platform embed (YouTube, Odysee, etc.) - needs WebView
          // Ensure Odysee URLs use the embed format
          let embedUrl = url;
          if (url.includes('odysee.com')) {
            // Convert watch URLs to embed URLs if needed
            embedUrl = url.replace('/watch?v=', '/$/embed/');
          }
          media.push({ type: 'embed', url: embedUrl });
        }
      }
    });
  }

  return media;
}