import React from 'react';
import { VideoEmbed, VideoType } from './embeds/VideoEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { ZoraEmbed } from './embeds/ZoraEmbed';
import { SnapshotEmbed } from './embeds/SnapshotEmbed';
import { ImageEmbed } from './embeds/ImageEmbed';

interface EmbedFactoryProps {
  token: string;
}

export const EmbedFactory = ({ token }: EmbedFactoryProps) => {
  // Token format: [[TYPE:ID]]
  const match = token.match(/^\[\[(YOUTUBE|VIMEO|ODYSEE|THREESPEAK|IPFSVIDEO|INSTAGRAM|ZORACOIN|SNAPSHOT|IMAGE):([^\]]+)\]\]$/);
  
  if (!match) return null;

  const type = match[1];
  const id = match[2];

  switch (type) {
    case 'YOUTUBE':
    case 'VIMEO':
    case 'ODYSEE':
    case 'THREESPEAK':
    case 'IPFSVIDEO':
      return <VideoEmbed type={type as VideoType} id={id} />;
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
