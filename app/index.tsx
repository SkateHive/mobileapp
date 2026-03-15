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
  Animated,
} from "react-native";
import { LoginForm } from "~/components/auth/LoginForm";
import {
  AuthError,
  useAuth,
} from "~/lib/auth-provider";
import { useAppSettings } from "~/lib/AppSettingsContext";
import {
  AccountNotFoundError,
  HiveError,
  InvalidKeyError,
  InvalidKeyFormatError,
} from "~/lib/hive-utils";
import { prefetchVideoFeed, warmUpVideoAssets, prefetchCommunityFeed, prefetchProfile, prefetchBalance } from "~/lib/hooks/useQueries";
import { theme } from "~/lib/theme";
import { LOGIN_BACKGROUND_TYPE } from "~/lib/constants";
import { MatrixRain } from "~/components/ui/loading-effects/MatrixRain";
import { Text } from "~/components/ui/text";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const DecryptingText = ({ text }: { text: string }) => {
  const chars = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
  const [displayedText, setDisplayedText] = React.useState("");

  React.useEffect(() => {
    let iteration = 0;
    let interval: NodeJS.Timeout;

    const startDecryption = () => {
      iteration = 0;
      interval = setInterval(() => {
        setDisplayedText(
          text
            .split("")
            .map((char, index) => {
              // Bit-flicker: 2% chance to show a random char even if "resolved"
              const isResolved = index < iteration;
              const shouldFlicker = isResolved && Math.random() < 0.02;

              if (isResolved && !shouldFlicker) {
                return text[index];
              }
              // Randomly sample from the authentic set
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(interval);
          // Wait 5 seconds before restarting the decryption loop
          setTimeout(startDecryption, 5000);
        }

        iteration += 1 / 3;
      }, 40) as any;
    };

    startDecryption();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [text]);

  return <>{displayedText}</>;
};

const BackgroundVideo = () => {
  const player = useVideoPlayer(
    require("../assets/videos/background.mp4"),
    (player) => {
      player.loop = true;
      player.play();
    }
  );

  return (
    <View style={styles.backgroundContainer} pointerEvents="none">
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

const LoginBackground = () => {
  const isMatrix = LOGIN_BACKGROUND_TYPE === "matrix";
  const glitchX = React.useRef(new Animated.Value(0)).current;
  const revealAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isMatrix) {
      // Glitch flicker loop
      const glitchLoop = () => {
        Animated.sequence([
          Animated.timing(glitchX, {
            toValue: Math.random() * 6 - 3,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(glitchX, {
            toValue: 0,
            duration: 60,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setTimeout(glitchLoop, Math.random() * 2000 + 500);
        });
      };
      glitchLoop();

      // Reveal animation
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start();
    }
  }, [isMatrix]);

  const animatedStyle = {
    transform: [{ translateX: glitchX }],
  };

  const revealStyle = {
    overflow: "hidden" as const,
    height: revealAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 120],
    }),
  };

  return (
    <View style={styles.backgroundContainer}>
      {isMatrix ? (
        <>
          <MatrixRain intensity={1} opacity={0.3} />
          {/* Logo Overlay */}
          <View style={styles.logoOverlayContainer} pointerEvents="none">
            {/* Native animations (Transform/Glitch) */}
            <Animated.View style={animatedStyle}>
              {/* JS-driven reveal (Height) */}
              <Animated.View style={revealStyle}>
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <Text style={styles.matrixGlow}>skatehive</Text>
                  <Text style={styles.matrixTextLogo}>
                    <DecryptingText text="skatehive" />
                  </Text>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </>
      ) : (
        <BackgroundVideo />
      )}
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

  const { settings } = useAppSettings();

  // Prefetch video feed + community feed + warm HTTP cache while user is on login screen
  React.useEffect(() => {
    prefetchVideoFeed(queryClient);
    prefetchCommunityFeed(queryClient);
    warmUpVideoAssets(queryClient);
  }, [queryClient]);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace(`/(tabs)/${settings.initialScreen}`);
    }
  }, [isAuthenticated, settings.initialScreen]);

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
      router.replace(`/(tabs)/${settings.initialScreen}` as any);
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
      router.replace(`/(tabs)/${settings.initialScreen}` as any);
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
      router.replace(`/(tabs)/${settings.initialScreen}` as any);
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
        <LoginBackground />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LoginBackground />

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
  backgroundContainer: {
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
  logoOverlayContainer: {
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  matrixGlow: {
    position: "absolute",
    color: "#00ff88",
    fontSize: 56,
    fontFamily: theme.fonts.bold,
    textShadowColor: "#00ff88",
    textShadowRadius: 40,
    opacity: 0.4,
    letterSpacing: 4,
    textTransform: "lowercase",
  },
  matrixTextLogo: {
    color: "#32CD32",
    fontSize: 56,
    fontFamily: theme.fonts.bold,
    textTransform: "lowercase",
    textAlign: "center",
    paddingVertical: 20,
    lineHeight: 70,
    letterSpacing: 4,
    // Neon glow effect
    textShadowColor: "rgba(50, 205, 50, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
