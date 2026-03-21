import React from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';
import { VideoConfig } from '~/lib/config/VideoConfig';

interface BaseVideoEmbedProps {
  url: string;
  isVisible?: boolean;
  isPrefetch?: boolean;
  author?: string;
  provider?: string;
}

export const BaseVideoEmbed = ({ url, isVisible, isPrefetch, author, provider = 'BaseVideoEmbed' }: BaseVideoEmbedProps) => {
  const { height: screenHeight } = useWindowDimensions();
  const [loading, setLoading] = React.useState(true);
  const startTime = React.useRef(Date.now());
  const logPrefix = `[${provider}]`;
  const identifier = author ? `@${author}` : url.split('/').pop();

  React.useEffect(() => {
    console.log(`${logPrefix} [${identifier}] MOUNTED at +${Date.now() - startTime.current}ms (visible: ${isVisible}, prefetch: ${isPrefetch})`);
  }, []);

  React.useEffect(() => {
    console.log(`${logPrefix} [${identifier}] VISIBILITY_CHANGE: ${isVisible} at +${Date.now() - startTime.current}ms`);
  }, [isVisible, identifier, logPrefix]);

  if (!url) return null;

  // Render if visible OR if it's being prefetched
  if (!isVisible && !isPrefetch) {
    return (
      <View style={styles.container} />
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={true} // Primary mobile autoplay block
        automaticallyAdjustContentInsets={false}
        scrollEnabled={false} // Prevent internal scrolls from triggering focus shifts
        keyboardDisplayRequiresUserAction={true}
        userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36"
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onLoadEnd={() => {
          console.log(`${logPrefix} [${identifier}] WEBVIEW_LOAD_END at +${Date.now() - startTime.current}ms`);
          setLoading(false);
        }}
        // Defensive script to pause any elements that try to bypass policy
        injectedJavaScript={`
          (function() {
            var videos = document.getElementsByTagName('video');
            for (var i = 0; i < videos.length; i++) {
              videos[i].pause();
              videos[i].autoplay = false;
            }
          })();
          true;
        `}
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
    aspectRatio: VideoConfig.aspectRatio,
    backgroundColor: '#000',
    marginTop: 0,
    marginBottom: theme.spacing.sm,
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
