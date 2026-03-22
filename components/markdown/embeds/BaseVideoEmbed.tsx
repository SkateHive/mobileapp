import React from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';
import { VideoConfig } from '~/lib/config/VideoConfig';
import { useAppSettings } from '~/lib/AppSettingsContext';

interface BaseVideoEmbedProps {
  url: string;
  isVisible?: boolean;
  isPrefetch?: boolean;
  author?: string;
  provider?: string;
}

export const BaseVideoEmbed = ({ url, isVisible, isPrefetch, author, provider = 'BaseVideoEmbed' }: BaseVideoEmbedProps) => {
  const { settings } = useAppSettings();
  const { height: screenHeight } = useWindowDimensions();
  const [loading, setLoading] = React.useState(true);
  const startTime = React.useRef(Date.now());
  const logPrefix = `[${provider}]`;
  const identifier = author ? `@${author}` : url.split('/').pop();

  // Reference to WebView for calling injectJavaScript
  const webViewRef = React.useRef<WebView>(null);

  // Detect direct video files (IPFS direct links or common extensions)
  const isDirectVideo = React.useMemo(() => {
    if (!url) return false;
    return (url.includes('/ipfs/') && !url.includes('embed')) || 
           /\.(mp4|mov|m4v|webm|ogv)$/i.test(url);
  }, [url]);

  // Use a static HTML wrapper to avoid reloads on prop change
  // Note: we only pass values that won't change after first load (like url)
  const htmlWrapper = React.useMemo(() => {
    if (!url) return '';
    return `
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
          video::-webkit-media-controls-start-playback-button { display: none !important; }
        </style>
      </head>
      <body>
        <video id="video" playsinline preload="auto" muted controls>
          <source src="${url}" type="video/mp4">
          <source src="${url}" type="video/quicktime">
          <source src="${url}">
        </video>
      </body>
    </html>
  `}, [url]);

  // Dispatch commands to different providers via postMessage
  const dispatchCommand = React.useCallback((type: 'PLAY' | 'PAUSE' | 'MUTE', value?: any) => {
    if (!webViewRef.current) return;

    if (isDirectVideo) {
      if (type === 'PLAY') {
        webViewRef.current.injectJavaScript(`
          var v = document.getElementById('video');
          if (v) v.play().catch(function(e) { console.log("Play failed", e); });
          true;
        `);
      } else if (type === 'PAUSE') {
        webViewRef.current.injectJavaScript(`
          var v = document.getElementById('video');
          if (v) v.pause();
          true;
        `);
      } else if (type === 'MUTE') {
        webViewRef.current.injectJavaScript(`
          var v = document.getElementById('video');
          if (v) v.muted = ${value};
          true;
        `);
      }
      return;
    }

    // YouTube API
    if (provider === 'YOUTUBE') {
      const func = type === 'PLAY' ? 'playVideo' : type === 'PAUSE' ? 'pauseVideo' : type === 'MUTE' ? (value ? 'mute' : 'unMute') : '';
      if (func) {
        webViewRef.current.injectJavaScript(`
          if (window.frames[0]) {
             window.frames[0].postMessage(JSON.stringify({"event":"command","func":"${func}","args":""}), '*');
          } else {
             window.postMessage(JSON.stringify({"event":"command","func":"${func}","args":""}), '*');
          }
          true;
        `);
      }
    }

    // Odysee / 3Speak (They often respond to standard 'play'/'pause' methods or postMessages)
    if (provider === 'ODYSEE' || provider === 'THREESPEAK') {
        const method = type === 'PLAY' ? 'play' : 'pause';
        webViewRef.current.injectJavaScript(`
            var iframe = document.getElementsByTagName('iframe')[0];
            var target = iframe ? iframe.contentWindow : window;
            target.postMessage(JSON.stringify({ method: '${method}' }), '*');
            true;
        `);
    }
  }, [provider, isDirectVideo]);

  // Sync playback state via injection (no reload)
  React.useEffect(() => {
    if (isVisible && settings.videoAutoPlay) {
      dispatchCommand('PLAY');
    } else {
      dispatchCommand('PAUSE');
    }
  }, [isVisible, settings.videoAutoPlay, provider, dispatchCommand]);

  // Sync mute state via injection (no reload)
  React.useEffect(() => {
    dispatchCommand('MUTE', settings.videoMuted);
  }, [settings.videoMuted, provider, dispatchCommand]);

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
        ref={webViewRef}
        source={isDirectVideo ? { html: htmlWrapper, baseUrl: url } : { uri: url }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={!settings.videoAutoPlay}
        automaticallyAdjustContentInsets={false}
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={true}
        userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36"
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onLoadEnd={() => {
          console.log(`${logPrefix} [${identifier}] WEBVIEW_LOAD_END at +${Date.now() - startTime.current}ms`);
          setLoading(false);
          // Trigger initial sync using the unified command dispatcher
          if (isVisible && settings.videoAutoPlay) {
            dispatchCommand('PLAY');
          } else {
            dispatchCommand('PAUSE');
          }
          dispatchCommand('MUTE', settings.videoMuted);
        }}
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
