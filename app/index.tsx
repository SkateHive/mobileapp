import { Ionicons } from "@expo/vector-icons";
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
import { Text } from "~/components/ui/text";
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
    <View style={styles.videoContainer}>
      <VideoView
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        player={player}
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

  const [deletingUser, setDeletingUser] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isFormVisible, setIsFormVisible] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push("/(tabs)/videos");
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

  const handleDeleteUser = async (username: string) => {
    setDeletingUser(username);
    try {
      await deleteStoredUser(username);
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setDeletingUser(null);
    }
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
      router.replace("/(tabs)/videos");
    } catch (error: any) {
      if (
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError ||
        error instanceof HiveError
      ) {
        setMessage(error.message);
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
      router.replace("/(tabs)/videos");
    } catch (error) {
      if (
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError ||
        error instanceof HiveError
      ) {
        setMessage((error as Error).message);
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

      <Pressable onPress={handleInfoPress} style={styles.infoButton}>
        <View style={styles.infoButtonContent}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#ffffff"
          />
        </View>
      </Pressable>

      {/* Faux gradient — stacked bands from transparent to opaque */}
      <View style={styles.fadeContainer} pointerEvents="none">
        <View style={[styles.fadeBand, { opacity: 0.0 }]} />
        <View style={[styles.fadeBand, { opacity: 0.15 }]} />
        <View style={[styles.fadeBand, { opacity: 0.35 }]} />
        <View style={[styles.fadeBand, { opacity: 0.55 }]} />
        <View style={[styles.fadeBand, { opacity: 0.75 }]} />
        <View style={[styles.fadeBand, { opacity: 0.9 }]} />
        <View style={[styles.fadeBand, { flex: 3, opacity: 1 }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.formWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              onDeleteUser={handleDeleteUser}
              deletingUser={deletingUser}
            />
          </View>
          <Text style={styles.alphaText}>Alpha</Text>
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
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  infoButton: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 10,
  },
  infoButtonContent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    padding: 8,
  },
  fadeContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
    flexDirection: "column",
  },
  fadeBand: {
    flex: 1,
    backgroundColor: "#000000",
  },
  formWrapper: {
    flex: 1,
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
  alphaText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 12,
  },
});
