import React from 'react';
import { MediaProvider } from './BaseProvider';
import { BaseVideoEmbed } from '~/components/markdown/embeds/BaseVideoEmbed';
import { useAppSettings } from '~/lib/AppSettingsContext';

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
  Component: ({ id, isVisible, isPrefetch, author }) => {
    const { settings } = useAppSettings();
    const autoplay = settings.videoAutoPlay && isVisible ? '1' : '0';
    const muted = settings.videoMuted ? '1' : '0';
    const finalUrl = `https://player.vimeo.com/video/${id}?autoplay=${autoplay}&muted=${muted}&origin=https://skatehive.app`;
    return <BaseVideoEmbed url={finalUrl} isVisible={isVisible} isPrefetch={isPrefetch} author={author} provider="VIMEO" />;
  }
};
