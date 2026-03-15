import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';

export type VideoType = 'YOUTUBE' | 'VIMEO' | 'ODYSEE' | 'THREESPEAK' | 'IPFSVIDEO';

interface VideoEmbedProps {
  type: VideoType;
  id: string;
}

export const VideoEmbed = ({ type, id }: VideoEmbedProps) => {
  const [loading, setLoading] = React.useState(true);

  const getEmbedUrl = () => {
    switch (type) {
      case 'YOUTUBE':
        return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
      case 'VIMEO':
        return `https://player.vimeo.com/video/${id}`;
      case 'THREESPEAK':
        return `https://play.3speak.tv/watch?v=${id}&mode=iframe`;
      case 'ODYSEE':
        // id might be a full URL for Odysee depending on regex
        return id.includes('https') ? id : `https://odysee.com/$/embed/${id}`;
      case 'IPFSVIDEO':
        return id.includes('https') ? id : `https://ipfs.skatehive.app/ipfs/${id}`;
      default:
        return '';
    }
  };

  const url = getEmbedUrl();

  if (!url) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.green} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    marginVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
