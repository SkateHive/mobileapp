import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';
import { useAppSettings } from '~/lib/AppSettingsContext';

export const ThreeSpeakProvider: MediaProvider = {
  name: 'THREESPEAK',
  patterns: [
    /\[!\[.*?\]\(.*?\)\]\((https?:\/\/3speak\.tv\/watch\?v=([\w\-/]+))\)/g,
    /(?:^|\s)https?:\/\/3speak\.tv\/watch\?v=([\w\-/]+)(?=\s|$)/gim
  ],
  resolve: (match: string) => {
    const idMatch = match.match(/v=([\w\-/]+)/i);
    return idMatch ? idMatch[1] : match;
  },
  Component: ({ id, isVisible, isPrefetch, author }) => {
    // We use a static URL to prevent WebView reload on visibility change.
    // Playback and mute are controlled via injectJavaScript in BaseVideoEmbed.
    const finalUrl = `https://play.3speak.tv/watch?v=${id}&mode=iframe&autoplay=1&muted=1`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} isPrefetch={isPrefetch} author={author} provider="THREESPEAK" />;
  }
};
