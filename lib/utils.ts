import type { Media, Post } from './types';
import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

// Simple utility to merge styles (replacement for cn function)
export function mergeStyles(...styles: any[]) {
  return styles.filter(Boolean).reduce((acc, style) => ({ ...acc, ...style }), {});
}

export function extractMediaFromBody(body: string): Media[] {
  if (!body || typeof body !== 'string') return [];
  const media: Media[] = [];
  const processedUrls = new Set<string>(); // Track URLs to avoid duplicates

  // Extract images
  const imageMatches = body.match(/!\[.*?\]\((.*?)\)/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const url = match.match(/\((.*?)\)/)?.[1];
      if (url && !processedUrls.has(url)) {
        media.push({ type: 'image', url });
        processedUrls.add(url);
      }
    });
  }

  // Extract videos from iframes
  const iframeMatches = body.match(/<iframe[\s\S]*?src\s*=\s*"(.*?)".*?>[\s\S]*?<\/iframe>/gim);
  if (iframeMatches) {
    iframeMatches.forEach(match => {
      const url = match.match(/src\s*=\s*"(.*?)"/i)?.[1];
      if (url && !processedUrls.has(url)) {
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
          let embedUrl = url;
          
          // Convert YouTube URLs to youtube-nocookie.com
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoIdMatch = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            if (videoIdMatch) {
              embedUrl = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}`;
            }
          }
          // Ensure Odysee URLs use the embed format
          else if (url.includes('odysee.com')) {
            // Convert watch URLs to embed URLs if needed
            embedUrl = url.replace('/watch?v=', '/$/embed/');
          }
          
          media.push({ type: 'embed', url: embedUrl });
        }
        processedUrls.add(url);
      }
    });
  }

  // Extract plain YouTube URLs (not in iframes)
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/g;
  let youtubeMatch;
  while ((youtubeMatch = youtubeRegex.exec(body)) !== null) {
    const videoId = youtubeMatch[1];
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    if (!processedUrls.has(embedUrl) && !processedUrls.has(youtubeMatch[0])) {
      media.push({ type: 'embed', url: embedUrl });
      processedUrls.add(embedUrl);
      processedUrls.add(youtubeMatch[0]);
    }
  }

  // Extract plain Odysee URLs (not in iframes)
  const odyseeRegex = /(?:https?:\/\/)?(?:www\.)?odysee\.com\/(@[^\/]+\/[^:]+:[a-zA-Z0-9]+)/g;
  let odyseeMatch;
  while ((odyseeMatch = odyseeRegex.exec(body)) !== null) {
    const videoPath = odyseeMatch[1];
    const embedUrl = `https://odysee.com/$/embed/${videoPath}`;
    if (!processedUrls.has(embedUrl) && !processedUrls.has(odyseeMatch[0])) {
      media.push({ type: 'embed', url: embedUrl });
      processedUrls.add(embedUrl);
      processedUrls.add(odyseeMatch[0]);
    }
  }

  // Extract plain IPFS/Video URLs (not in iframes)
  // Matches: ipfs.skatehive.app/ipfs/HASH, or .mp4, .mov links
  const directVideoRegex = /(https?:\/\/[^\s'"<>]+\.(?:mp4|mov|webm|m3u8)|https?:\/\/ipfs\.[^\s'"<>]+|https?:\/\/[^\s'"<>]+\/ipfs\/[a-zA-Z0-9]+)/gi;
  let videoMatch;
  while ((videoMatch = directVideoRegex.exec(body)) !== null) {
    const url = videoMatch[0];
    if (!processedUrls.has(url)) {
      media.push({ type: 'video', url });
      processedUrls.add(url);
    }
  }

  // Extract plain 3Speak URLs
  const threeSpeakRegex = /(?:https?:\/\/)?(?:www\.)?3speak\.tv\/watch\?v=([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/g;
  let threeSpeakMatch;
  while ((threeSpeakMatch = threeSpeakRegex.exec(body)) !== null) {
    const videoId = threeSpeakMatch[1];
    const embedUrl = `https://play.3speak.tv/watch?v=${videoId}`;
    if (!processedUrls.has(embedUrl)) {
      media.push({ type: 'embed', url: embedUrl });
      processedUrls.add(embedUrl);
    }
  }

  return media;
}

// Remove video links from body text (both YouTube and Odysee)
export function removeVideoLinksFromBody(body: string): string {
  let cleanedBody = body;
  
  // Remove YouTube URLs
  cleanedBody = cleanedBody.replace(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/g,
    ''
  );
  
  // Remove Odysee URLs
  cleanedBody = cleanedBody.replace(
    /(?:https?:\/\/)?(?:www\.)?odysee\.com\/(@[^\/]+\/[^:]+:[a-zA-Z0-9]+)/g,
    ''
  );
  
  // Clean up extra whitespace that may result from URL removal
  cleanedBody = cleanedBody.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  
  return cleanedBody;
}