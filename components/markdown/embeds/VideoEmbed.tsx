import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';
import { BaseVideoEmbed } from './BaseVideoEmbed';

export type VideoType = 'YOUTUBE' | 'VIMEO' | 'ODYSEE' | 'THREESPEAK' | 'IPFSVIDEO';

interface VideoEmbedProps {
  type: VideoType;
  id: string;
  isVisible?: boolean;
  isPrefetch?: boolean;
  author?: string;
}

export const VideoEmbed = ({ type, id, isVisible, isPrefetch, author }: VideoEmbedProps) => {
  const getEmbedUrl = () => {
    switch (type) {
      case 'YOUTUBE':
        return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&autoplay=0&mute=1&origin=https://skatehive.app`;
      case 'VIMEO':
        return `https://player.vimeo.com/video/${id}?autoplay=0&muted=1&origin=https://skatehive.app`;
      case 'THREESPEAK':
        return `https://play.3speak.tv/watch?v=${id}&mode=iframe&autoplay=0&muted=1`;
      case 'ODYSEE':
        let odyseeBase = '';
        if (id.includes('odysee.com/$/embed')) {
          odyseeBase = id;
        } else if (id.startsWith('http')) {
           const match = id.match(/odysee\.com\/(?:[^\/]+\/)?([\w@:%._\+~#=\/-]+)/i);
           const cleanId = match ? match[1] : id;
           odyseeBase = `https://odysee.com/$/embed/${cleanId}`;
        } else {
          odyseeBase = `https://odysee.com/$/embed/${id}`;
        }
        return odyseeBase.includes('?') ? `${odyseeBase}&autoplay=false&muted=true` : `${odyseeBase}?autoplay=false&muted=true`;
      case 'IPFSVIDEO':
        const ipfsUrl = id.includes('https') ? id : `https://ipfs.skatehive.app/ipfs/${id}`;
        return ipfsUrl.includes('?') ? `${ipfsUrl}&autoplay=0&muted=1` : `${ipfsUrl}?autoplay=0&muted=1`;
      default:
        return '';
    }
  };

  const url = getEmbedUrl();
  if (!url) return null;

  return <BaseVideoEmbed url={url} isVisible={isVisible} isPrefetch={isPrefetch} author={author} provider={type} />;
};

const styles = StyleSheet.create({});
