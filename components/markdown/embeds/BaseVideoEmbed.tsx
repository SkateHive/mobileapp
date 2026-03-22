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

  // Detect direct video files (IPFS direct links or common extensions)
  const isDirectVideo = (url.includes('/ipfs/') && !url.includes('embed')) || 
                        /\.(mp4|mov|m4v|webm|ogv)$/i.test(url);

  const htmlWrapper = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body, html { 
            margin: 0; padding: 0; width: 100%; height: 100%; 
            overflow: hidden; background-color: #000;
            display: flex; justify-content: center; align-items: center;
          }
          video { 
            width: 100%; height: 100%; object-fit: contain; 
            max-width: 100vw; max-height: 100vh;
          }
          /* Hide default play button for cleaner prefetch look if possible */
          video::-webkit-media-controls-start-playback-button {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <video 
          id="video"
          controls 
          playsinline 
          preload="auto"
          ${isPrefetch && !isVisible ? 'muted' : ''}
        >
          <source src="${url}" type="video/mp4">
          <source src="${url}" type="video/quicktime">
          <source src="${url}">
        </video>
        <script>
          const v = document.getElementById('video');
          // Manual play/pause based on messages if needed, but for now we rely on user action
          // to comply with mobile policies while in WebView.
          // However, we can listen for visibility messages from RN if we wanted.
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={isDirectVideo ? { html: htmlWrapper, baseUrl: url } : { uri: url }}
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
