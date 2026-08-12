import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { ImmersivePostViewer } from "~/components/Feed/ImmersivePostViewer";
import { useViewerPayload } from "~/lib/viewer-store";
import { theme } from "~/lib/theme";

/**
 * The immersive post viewer, as a route rather than a Modal (#35).
 *
 * Being a stack screen is the whole point: iOS gives back-swipe to a pushed
 * screen for free, with the dismissal animation included. Four hand-rolled
 * gestures failed against the vertical pager before this — the fix was to stop
 * competing with the platform and let it do the navigation.
 *
 * The posts come from `viewer-store` rather than route params, which only carry
 * strings. See that file for why refetching here would be worse.
 */
export default function PostViewerScreen() {
  const payload = useViewerPayload();

  // Nothing to show: a cold deep link, or the store cleared behind us. Leaving
  // beats rendering an empty black screen with no way out — and on a cold link
  // there's no history to go back to, so that case needs somewhere to land.
  useEffect(() => {
    if (payload) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, [payload]);

  if (!payload) return <View style={styles.empty} />;

  return (
    <ImmersivePostViewer
      posts={payload.posts}
      initialIndex={payload.initialIndex}
      hasMore={payload.hasMore}
      onLoadMore={payload.onLoadMore}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, backgroundColor: theme.colors.background },
});
