import React from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';

interface BaseVideoEmbedProps {
  url: string;
  isVisible?: boolean;
}

export const BaseVideoEmbed = ({ url, isVisible }: BaseVideoEmbedProps) => {
  const [loading, setLoading] = React.useState(true);

  if (!url) return null;

  // Lazy mounting: Only render WebView if visible
  if (!isVisible) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.green} size="small" />
        </View>
      </View>
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
        onLoadEnd={() => setLoading(false)}
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
    aspectRatio: 1, // Square as a better middle ground for vertical/horizontal
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
