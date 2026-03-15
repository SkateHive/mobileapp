import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';

export const YouTubeProvider: MediaProvider = {
  name: 'YOUTUBE',
  patterns: [
    /(?:^|\s)https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[\?\&\#][\S]*)?(?=\s|$)/gim,
    /<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/embed\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*><\/iframe>/gim
  ],
  resolve: (match: string) => {
    const idMatch = match.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return idMatch ? idMatch[1] : match;
  },
  Component: ({ id, isVisible }) => {
    const finalUrl = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&autoplay=0&mute=1&origin=https://skatehive.app`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} />;
  }
};
