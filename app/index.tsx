import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  UIManager,
  View,
  StyleSheet,
} from "react-native";
import { LoginForm } from "~/components/auth/LoginForm";
import {
  AuthError,
  useAuth,
} from "~/lib/auth-provider";
import {
  AccountNotFoundError,
  HiveError,
  InvalidKeyError,
  InvalidKeyFormatError,
} from "~/lib/hive-utils";
import { prefetchVideoFeed, warmUpVideoAssets, prefetchCommunityFeed, prefetchProfile, prefetchBalance } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const BackgroundVideo = () => {
  const player = useVideoPlayer(
    require("../assets/videos/background.mp4"),
    (player) => {
      player.loop = true;
      player.play();
    }
  );

  return (
    <View style={styles.videoContainer} pointerEvents="none">
      <VideoView
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        player={player}
        nativeControls={false}
        pointerEvents="none"
      />
    </View>
  );
};

export default function Index() {
  const {
    isAuthenticated,
    isLoading,
    storedUsers,
    login,
    loginStoredUser,
    enterSpectatorMode,
    deleteStoredUser,
  } = useAuth();
  const queryClient = useQueryClient();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isFormVisible, setIsFormVisible] = React.useState(false);

  // Prefetch video feed + community feed + warm HTTP cache while user is on login screen
  React.useEffect(() => {
    prefetchVideoFeed(queryClient);
    prefetchCommunityFeed(queryClient);
    warmUpVideoAssets(queryClient);
  }, [queryClient]);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/videos");
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsFormVisible(true);
    }
  }, [isLoading, isAuthenticated]);

  const handleInfoPress = () => {
    router.push("/about");
  };



  const handleSpectator = async () => {
    try {
      await enterSpectatorMode();
      router.replace("/(tabs)/videos");
    } catch (error) {
      console.error("Error entering spectator mode:", error);
      setMessage("Error entering spectator mode");
    }
  };

  const handleSubmit = async (method: "biometric" | "pin", pin?: string) => {
    try {
      if (!username || !password) {
        setMessage("Please enter both username and posting key");
        return;
      }
      await login(username, password, method, pin);
      // Prefetch user data after successful login
      prefetchProfile(queryClient, username);
      prefetchBalance(queryClient, username);
      router.replace("/(tabs)/videos");
      } catch (error: any) {
        if (
          error instanceof InvalidKeyFormatError ||
          error instanceof AccountNotFoundError ||
          error instanceof InvalidKeyError ||
          error instanceof AuthError ||
          error instanceof HiveError
        ) {
          // Suppress biometric failure messages as requested
          if (!error.message.includes('Biometric authentication')) {
            setMessage(error.message);
          }
        } else {
          setMessage("An unexpected error occurred");
        }
      }
  };

  const handleQuickLogin = async (
    selectedUsername: string,
    method: "biometric" | "pin",
    pin?: string
  ) => {
    try {
      await loginStoredUser(selectedUsername, pin);
      // Prefetch user data after successful quick login
      prefetchProfile(queryClient, selectedUsername);
      prefetchBalance(queryClient, selectedUsername);
      router.replace("/(tabs)/videos");
    } catch (error) {
      if (
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError ||
        error instanceof HiveError
      ) {
        // Suppress biometric failure messages as requested
        const msg = (error as Error).message;
        if (!msg.includes('Biometric authentication')) {
          setMessage(msg);
        }
      } else {
        setMessage("Error with quick login");
      }
    }
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

      <Pressable onPress={handleInfoPress} style={styles.infoButton} accessibilityRole="button" accessibilityLabel="More Info">
        <View style={styles.infoButtonContent}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#ffffff"
          />
        </View>
      </Pressable>

      {/* Dark fade over video so form text is readable */}
      <View style={styles.fadeOverlay} pointerEvents="none">
        <View style={[styles.fadeBand, { opacity: 0 }]} />
        <View style={[styles.fadeBand, { opacity: 0.08 }]} />
        <View style={[styles.fadeBand, { opacity: 0.18 }]} />
        <View style={[styles.fadeBand, { opacity: 0.32 }]} />
        <View style={[styles.fadeBand, { opacity: 0.48 }]} />
        <View style={[styles.fadeBand, { opacity: 0.62 }]} />
        <View style={[styles.fadeBand, { flex: 2, opacity: 0.82 }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.formWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        pointerEvents="box-none"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          pointerEvents="box-none"
        >
          <View style={styles.spacer} />
          <View
            style={[
              styles.formContainer,
              {
                opacity: isFormVisible ? 1 : 0,
                transform: [{ translateY: isFormVisible ? 0 : 40 }],
              },
            ]}
          >
            <LoginForm
              username={username}
              password={password}
              message={message}
              onUsernameChange={(text) => setUsername(text.toLowerCase())}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
              onSpectator={handleSpectator}
              storedUsers={storedUsers}
              onQuickLogin={handleQuickLogin}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  videoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  infoButton: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 999,
  },
  infoButtonContent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    padding: 8,
  },
  fadeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    flexDirection: "column",
    zIndex: 1,
  },
  fadeBand: {
    flex: 1,
    backgroundColor: "#000000",
  },
  formWrapper: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  spacer: {
    flex: 1,
    minHeight: 80,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
});
