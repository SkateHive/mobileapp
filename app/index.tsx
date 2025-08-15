import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAuth } from "~/lib/auth-provider";
import { theme } from "~/lib/theme";

const BackgroundVideo = () => {
  const player = useVideoPlayer(
    require("../assets/videos/background.mp4"),
    (player) => {
      player.loop = true;
      player.play();
    }
  );

  return (
    <View style={styles.videoContainer}>
      <VideoView
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        player={player}
      />
      <View style={styles.overlay} />
    </View>
  );
};

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push("/(tabs)/feed");
    }
  }, [isAuthenticated]);

  const handlePress = () => {
    router.push("/login");
  };

  const handleInfoPress = () => {
    router.push("/about");
  };

  if (isLoading || isAuthenticated) {
    return (
      <View style={styles.container}>
        <BackgroundVideo />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackgroundVideo />
      <Pressable
        onPress={handleInfoPress}
        style={styles.infoButton}
      >
        <View style={styles.infoButtonContent}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#ffffff"
          />
        </View>
      </Pressable>

      <View style={styles.bottomContent}>
        <Button
          style={styles.button}
          size="xl"
          onPress={handlePress}
          haptic="success"
        >
          <Text style={styles.buttonText}>Let's go!</Text>
        </Button>
        <Text style={styles.alphaText}>Alpha</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  infoButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    zIndex: 10,
  },
  infoButtonContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  bottomContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    width: '100%',
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: theme.colors.primary,
  },
  buttonText: {
    color: theme.colors.primary,
  },
  alphaText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
});
