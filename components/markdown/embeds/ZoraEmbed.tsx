import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '~/lib/theme';

interface ZoraEmbedProps {
  address: string;
}

export const ZoraEmbed = ({ address }: ZoraEmbedProps) => {
  const [loading, setLoading] = React.useState(true);
  
  // Use the web preview URL for Zora content
  const zoraUrl = `https://zora.co/coin/${address}`;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: zoraUrl }}
        style={styles.webview}
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
    height: 480,
    backgroundColor: theme.colors.card,
    marginTop: 0,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.green, // Accentuate Web3 content
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
