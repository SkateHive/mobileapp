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
  onPlaybackStarted?: () => void;
}

/**
 * Plays IPFS videos via HTML5 <video> tag in a WebView.
 * Styled to feel smooth and native — no browser chrome, controls only on tap,
 * loading overlay until first frame renders.
 */
export function IpfsVideoPlayer({
  url,
  autoplay = true,
  muted = true,
  loop = true,
  contentFit = 'contain',
  playing = true,
  onPlaybackStarted,
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

  // Sanitize URL to prevent XSS
  const sanitizedUrl = url.replace(/["<>]/g, '');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; }
          html, body {
            width: 100%; height: 100%;
            overflow: hidden; background: #000;
            -webkit-tap-highlight-color: transparent;
          }
          video {
            width: 100%; height: 100%;
            object-fit: ${contentFit};
            background: #000;
          }
          /* Hide controls by default — show on tap via JS */
          video::-webkit-media-controls {
            display: none !important;
          }
          video.show-controls::-webkit-media-controls {
            display: flex !important;
          }
        </style>
      </head>
      <body>
        <video
          id="v"
          src="${sanitizedUrl}"
          ${autoplay && playing ? 'autoplay' : ''}
          ${muted ? 'muted' : ''}
          ${loop ? 'loop' : ''}
          playsinline
          preload="${playing ? 'auto' : 'none'}"
        ></video>
        <script>
          var v = document.getElementById('v');
          var controlsTimer;

          // Notify RN on error
          v.addEventListener('error', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('VIDEO_ERROR');
          });

          // Notify RN when first frame is ready — hide loading overlay
          v.addEventListener('playing', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('VIDEO_PLAYING');
          });
          v.addEventListener('loadeddata', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('VIDEO_PLAYING');
          });

          // Tap to toggle controls (Instagram-style)
          v.addEventListener('click', function(e) {
            e.preventDefault();
            if (v.classList.contains('show-controls')) {
              v.classList.remove('show-controls');
              v.removeAttribute('controls');
            } else {
              v.classList.add('show-controls');
              v.setAttribute('controls', '');
              // Auto-hide controls after 3s
              clearTimeout(controlsTimer);
              controlsTimer = setTimeout(function() {
                v.classList.remove('show-controls');
                v.removeAttribute('controls');
              }, 3000);
            }
          });

          // Tap on muted video to unmute (common UX pattern)
          v.addEventListener('volumechange', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
              v.muted ? 'VIDEO_MUTED' : 'VIDEO_UNMUTED'
            );
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={[styles.webview, isLoading && styles.webviewHidden]}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'VIDEO_ERROR') {
            setHasError(true);
          }
          if (event.nativeEvent.data === 'VIDEO_PLAYING') {
            setIsLoading(false);
            onPlaybackStarted?.();
          }
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
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
  webviewHidden: {
    opacity: 0,
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
