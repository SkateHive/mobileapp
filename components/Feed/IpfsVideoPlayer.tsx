import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/text';
import { theme } from '../../lib/theme';

interface IpfsVideoPlayerProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  contentFit?: 'contain' | 'cover';
  playing?: boolean;
}

/**
 * Plays IPFS videos via HTML5 <video> tag in a WebView.
 *
 * Why not expo-video (AVPlayer)?
 * The IPFS gateway (Pinata/Cloudflare) doesn't support HTTP Range requests —
 * it returns 200 with full content instead of 206 Partial Content.
 * AVPlayer requires range requests to stream video, so it shows a QuickTime
 * logo and never plays. HTML5 <video> handles progressive download fine —
 * same approach the SkateHive webapp uses.
 *
 * If <video> also fails (e.g. WebM on older iOS), shows "Open in browser" link.
 */
export function IpfsVideoPlayer({
  url,
  autoplay = true,
  muted = true,
  loop = true,
  contentFit = 'contain',
  playing = true,
}: IpfsVideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    const cleanUrl = url.split('?')[0];
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="videocam-outline" size={36} color={theme.colors.gray} />
        <Text style={styles.errorText}>Can't play this video format</Text>
        <Pressable
          style={styles.openWebButton}
          onPress={() => Linking.openURL(cleanUrl)}
        >
          <Ionicons name="open-outline" size={16} color={theme.colors.green} />
          <Text style={styles.openWebText}>Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
          video { width: 100%; height: 100%; object-fit: ${contentFit}; background: #000; }
        </style>
      </head>
      <body>
        <video
          id="v"
          src="${url}"
          ${autoplay && playing ? 'autoplay' : ''}
          ${muted ? 'muted' : ''}
          ${loop ? 'loop' : ''}
          playsinline
          preload="auto"
          controls
        ></video>
        <script>
          var v = document.getElementById('v');
          v.addEventListener('error', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('VIDEO_ERROR');
          });
          v.addEventListener('playing', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('VIDEO_PLAYING');
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'VIDEO_ERROR') {
            setHasError(true);
          }
          if (event.nativeEvent.data === 'VIDEO_PLAYING') {
            setIsLoading(false);
          }
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: theme.colors.gray,
    fontSize: 13,
  },
  openWebButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.green,
  },
  openWebText: {
    color: theme.colors.green,
    fontSize: 13,
  },
});
