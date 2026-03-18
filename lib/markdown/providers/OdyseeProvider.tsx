import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';

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
  Component: ({ id, isVisible }: { id: string; isVisible?: boolean }) => {
    let odyseeBase = '';
    if (id.includes('odysee.com/$/embed')) {
      odyseeBase = id;
    } else if (id.startsWith('http')) {
       odyseeBase = id;
    } else {
      odyseeBase = `https://odysee.com/$/embed/${id}`;
    }
    const finalUrl = odyseeBase.includes('?') ? `${odyseeBase}&autoplay=false&muted=true` : `${odyseeBase}?autoplay=false&muted=true`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} />;
  }
};
