import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';
import { VideoPlayer } from '~/components/Feed/VideoPlayer';
import { VideoConfig } from '~/lib/config/VideoConfig';

export const IPFSProvider: MediaProvider = {
  name: 'IPFSVIDEO',
  patterns: [
    /<div class="video-embed" data-ipfs-hash="([^"]+)">[\s\S]*?<\/div>/g,
    /<iframe[\s\S]*?src=["']https?:\/\/ipfs\.skatehive\.app\/ipfs\/([\w-]+)[^"']*["'][\s\S]*?>[\s\S]*?<\/iframe>/gim
  ],
  resolve: (match: string) => {
    const divMatch = match.match(/data-ipfs-hash="([^"]+)"/i);
    if (divMatch) return divMatch[1];
    const iframeMatch = match.match(/src=["']https?:\/\/ipfs\.skatehive.app\/ipfs\/([\w-]+)[^"']*["']/i);
    if (iframeMatch) return iframeMatch[1];
    return match;
  },
  Component: ({ id, isVisible, isPrefetch, author }: { id: string, isVisible?: boolean, isPrefetch?: boolean, author?: string }) => {
    const ipfsUrl = id.includes('https') ? id : `https://ipfs.skatehive.app/ipfs/${id}`;
    
    if (VideoConfig.preferredRenderer === 'native') {
      return (
        <VideoPlayer 
          url={ipfsUrl} 
          playing={isVisible} 
          shouldPreload={isPrefetch || isVisible}
          author={author}
          provider="IPFS"
          loop={true}
          style={{
            width: '100%',
            aspectRatio: VideoConfig.aspectRatio,
          }}
        />
      );
    }

    return <BaseVideoEmbed url={ipfsUrl} isVisible={isVisible} isPrefetch={isPrefetch} author={author} provider="IPFS" />;
  }
};
