import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { getLoadingEffect } from "./loading-effects";
import { theme } from "~/lib/theme";
import { useAppSettings } from "~/lib/AppSettingsContext";
import { SkeletonBackground } from "./loading-effects/SkeletonBackground";

export function LoadingScreen() {
  const { settings } = useAppSettings();
  
  const renderBackground = () => {
    switch (settings.theme) {
      case 'matrix':
        const MatrixRainComp = getLoadingEffect("matrix").component;
        return <MatrixRainComp />;
      case 'skatehive':
      default:
        return (
          <View style={styles.activityContainer}>
            <ActivityIndicator size="large" color={theme.colors.green} />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderBackground()}
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
