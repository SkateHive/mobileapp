import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';

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
  Component: ({ id, isVisible }) => {
    const finalUrl = `https://play.3speak.tv/watch?v=${id}&mode=iframe&autoplay=0&muted=1`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} />;
  }
};
