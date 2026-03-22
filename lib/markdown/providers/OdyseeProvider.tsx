import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';
import { useAppSettings } from '~/lib/AppSettingsContext';

export const OdyseeProvider: MediaProvider = {
  name: 'ODYSEE',
  patterns: [
    /(?:^|\s)https?:\/\/odysee\.com\/(?:[^\s]+)\/([\w@:%._\+~#=\/-]+)(?=\?[\S]*)?(?=\s|$)/gim,
    /<iframe[^>]*src=["'](https?:\/\/odysee\.com\/[^"']+)["'][^>]*><\/iframe>/gim
  ],
  resolve: (match: string) => {
    if (match.includes('<iframe')) {
      const srcMatch = match.match(/src=["'](https?:\/\/odysee\.com\/[^"']+)["']/i);
      return srcMatch ? srcMatch[1] : match;
    }
    const idMatch = match.match(/odysee\.com\/(?:[^\/]+\/)?([\w@:%._\+~#=\/-]+)/i);
    return idMatch ? idMatch[1] : match;
  },
  Component: ({ id, isVisible, isPrefetch, author }) => {
    // We use a static URL to prevent WebView reload on visibility change.
    // Check if id is already a full URL (from iframe resolution)
    let finalUrl = id;
    if (!id.startsWith('http')) {
      finalUrl = `https://odysee.com/$/embed/${id}`;
    }
    
    // Append parameters for pre-loading (always autoplay+muted, synced via JS later)
    finalUrl += finalUrl.includes('?') ? '&autoplay=1&muted=1' : '?autoplay=1&muted=1';
    
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} isPrefetch={isPrefetch} author={author} provider="ODYSEE" />;
  }
};
