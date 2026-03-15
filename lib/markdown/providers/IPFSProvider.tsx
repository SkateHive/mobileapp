import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';

export const IPFSProvider: MediaProvider = {
  name: 'IPFSVIDEO',
  patterns: [
    /<div class="video-embed" data-ipfs-hash="([^"]+)">[\s\S]*?<\/div>/g,
    /<iframe[\s\S]*?src=["']https?:\/\/ipfs\.skatehive\.app\/ipfs\/([\w-]+)[^"']*["'][\s\S]*?>[\s\S]*?<\/iframe>/gim
  ],
  resolve: (match: string) => {
    const divMatch = match.match(/data-ipfs-hash="([^"]+)"/i);
    if (divMatch) return divMatch[1];
    const iframeMatch = match.match(/src=["']https?:\/\/ipfs\.skatehive\.app\/ipfs\/([\w-]+)[^"']*["']/i);
    if (iframeMatch) return iframeMatch[1];
    return match;
  },
  Component: ({ id, isVisible }) => {
    const ipfsUrl = id.includes('https') ? id : `https://ipfs.skatehive.app/ipfs/${id}`;
    const finalUrl = ipfsUrl.includes('?') ? `${ipfsUrl}&autoplay=0&muted=1` : `${ipfsUrl}?autoplay=0&muted=1`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} />;
  }
};
