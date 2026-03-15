import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';

export const VimeoProvider: MediaProvider = {
  name: 'VIMEO',
  patterns: [
    /(?:^|\s)https?:\/\/(?:www\.)?(?:vimeo\.com\/(?:channels\/[\w]+\/)?|player\.vimeo\.com\/video\/)([0-9]+)(?:[\?\&\#][\S]*)?(?=\s|$)/gim,
    /<iframe[^>]*src=["'](?:https?:)?\/\/(?:player\.)?vimeo\.com\/video\/([0-9]+)[^"']*["'][^>]*><\/iframe>/gim
  ],
  resolve: (match: string) => {
    const idMatch = match.match(/(?:video\/)([0-9]+)/i);
    return idMatch ? idMatch[1] : match;
  },
  Component: ({ id, isVisible }) => {
    const finalUrl = `https://player.vimeo.com/video/${id}?autoplay=0&muted=1&origin=https://skatehive.app`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} />;
  }
};
