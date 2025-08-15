import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { getLoadingEffect } from "./loading-effects";
import { theme } from "~/lib/theme";

export function LoadingScreen() {
  const BackgroundEffect = getLoadingEffect("matrix").component;

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      {/* <View style={styles.activityContainer}>
        <ActivityIndicator size="large" color={"green"} />
      </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background,
  },
  activityContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
