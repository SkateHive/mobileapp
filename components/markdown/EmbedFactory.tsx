import React from 'react';
import { VideoEmbed, VideoType } from './embeds/VideoEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { ZoraEmbed } from './embeds/ZoraEmbed';
import { SnapshotEmbed } from './embeds/SnapshotEmbed';
import { ImageEmbed } from './embeds/ImageEmbed';
import { Registry } from '~/lib/markdown/providers';

interface EmbedFactoryProps {
  token: string;
  isVisible?: boolean;
}

export const EmbedFactory = ({ token, isVisible }: EmbedFactoryProps) => {
  // Token format: [[TYPE:ID]] - allow some whitespace and case-insensitive
  // Aliasing IAMGE to IMAGE to handle common typos
  const match = token.match(/^\s*\[\[(YOUTUBE|VIMEO|ODYSEE|THREESPEAK|IPFSVIDEO|INSTAGRAM|ZORACOIN|SNAPSHOT|IMAGE|IAMGE):([^\]]+)\]\]\s*$/i);
  
  if (!match) return null;

  let type = match[1].toUpperCase();
  const id = match[2].trim();

  if (type === 'IAMGE') type = 'IMAGE';

  // A. Check for Modular Provider first
  const provider = Registry.getProvider(type);
  if (provider) {
    return <provider.Component id={id} isVisible={isVisible} />;
  }

  // B. Fallback to Legacy Switch
  switch (type) {
    case 'YOUTUBE':
    case 'VIMEO':
    case 'ODYSEE':
    case 'THREESPEAK':
    case 'IPFSVIDEO':
      return <VideoEmbed type={type as VideoType} id={id} isVisible={isVisible} />;
    case 'INSTAGRAM':
      return <InstagramEmbed url={id} />;
    case 'ZORACOIN':
      return <ZoraEmbed address={id} />;
    case 'SNAPSHOT':
      return <SnapshotEmbed url={id} />;
    case 'IMAGE':
      return <ImageEmbed url={id} />;
    default:
      return null;
  }
};
