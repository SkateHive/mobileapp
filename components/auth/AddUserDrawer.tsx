import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PinInput } from "~/components/ui/PinInput";
import { theme } from "~/lib/theme";
import * as WebBrowser from 'expo-web-browser';

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AddUserDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  // Form props
  username: string;
  onUsernameChange: (text: string) => void;
  password: string;
  onPasswordChange: (text: string) => void;
  pin: string;
  onPinChange: (text: string) => void;
  method: 'pin' | 'biometric';
  onMethodChange: (method: 'pin' | 'biometric') => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  deviceAuth: {
    hasBiometric: boolean;
    hasDevicePin: boolean;
  };
}

export function AddUserDrawer({
  isVisible,
  onClose,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  pin,
  onPinChange,
  method,
  onMethodChange,
  onSubmit,
  isLoading,
  deviceAuth,
}: AddUserDrawerProps) {
  const [viewState, setViewState] = useState<'selection' | 'form'>('selection');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // PanResponder for swipe down to close
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          pan.y.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Close if swiped down enough or fast enough
          handleClose();
        } else {
          // Spring back
          Animated.spring(pan.y, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isVisible) {
      setViewState('selection');
      pan.y.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, fadeAnim]);

  const handleClose = () => {
    onClose();
  };

  const handleNewUser = async () => {
    await WebBrowser.openBrowserAsync('https://hive.io/');
    handleClose();
  };

  const handleExistingUser = () => {
    setViewState('form');
  };

  if (!isVisible && slideAnim.addListener === undefined) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Drawer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        pointerEvents="box-none"
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheetContainer,
            { 
              transform: [
                { translateY: slideAnim },
                { translateY: pan.y }
              ] 
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.colors.primary} />
            </Pressable>
          </View>

          <View style={styles.content}>
            {viewState === 'selection' ? (
              <View style={styles.selectionContainer}>
                <Text style={styles.title}>Welcome to Skatehive</Text>
                <Text style={styles.subtitle}>Choose how you want to join the community</Text>
                
                <Button 
                  onPress={handleExistingUser}
                  variant="default"
                  style={styles.mainButton}
                >
                  <Text style={styles.buttonText}>Existing User</Text>
                </Button>

                <Button 
                  onPress={handleNewUser}
                  variant="outline"
                  style={styles.mainButton}
                >
                  <Text style={styles.outlineButtonText}>Create New Account</Text>
                </Button>
                
                <Text style={styles.infoText}>
                  New accounts are created via Hive.io
                </Text>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <Text style={styles.title}>Login with Hive</Text>
                
                <Input
                  placeholder="Hive Username"
                  value={username}
                  onChangeText={onUsernameChange}
                  style={styles.input}
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                />
                
                <Input
                  placeholder="Posting Key"
                  value={password}
                  onChangeText={onPasswordChange}
                  secureTextEntry
                  style={styles.input}
                  placeholderTextColor={theme.colors.muted}
                  autoComplete="password"
                  textContentType="password"
                />

                {/* Biometric/PIN Toggle */}
                {(deviceAuth.hasBiometric || deviceAuth.hasDevicePin) && (
                  <View style={styles.authMethodContainer}>
                    <Text style={styles.authMethodLabel}>Security Method:</Text>
                    <View style={styles.toggleContainer}>
                      <Pressable
                        style={[
                          styles.toggleOption,
                          method === 'pin' && styles.toggleOptionActive
                        ]}
                        onPress={() => onMethodChange('pin')}
                      >
                        <Text style={[
                          styles.toggleText,
                          method === 'pin' && styles.toggleTextActive
                        ]}>
                          PIN
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.toggleOption,
                          method === 'biometric' && styles.toggleOptionActive
                        ]}
                        onPress={() => onMethodChange('biometric')}
                      >
                        <Text style={[
                          styles.toggleText,
                          method === 'biometric' && styles.toggleTextActive
                        ]}>
                          {deviceAuth.hasBiometric ? 'Biometric' : 'Device PIN'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {method === 'pin' && (
                  <View style={styles.pinSection}>
                    <Text style={styles.pinLabel}>Create a PIN for this device:</Text>
                    <PinInput
                      value={pin}
                      onChangeText={onPinChange}
                    />
                  </View>
                )}

                {method === 'biometric' && (
                  <Text style={styles.biometricInfo}>
                    Your posting key will be secured with {deviceAuth.hasBiometric ? 'biometric authentication' : 'device PIN'}
                  </Text>
                )}

                <Button
                  onPress={onSubmit}
                  style={styles.loginButton}
                  disabled={isLoading || !username || !password || (method === 'pin' && pin.length < 4)}
                >
                  <Text style={styles.loginButtonText}>
                    {isLoading ? 'Authenticating...' : 'Login'}
                  </Text>
                </Button>
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)", // Darker backdrop
    zIndex: 100,
  },
  keyboardAvoidingView: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 101,
  },
  sheetContainer: {
    backgroundColor: theme.colors.background,
    width: '100%',
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    paddingBottom: theme.spacing.xxxl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 25,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  handleBar: {
    width: 60,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  closeButton: {
    position: "absolute",
    right: theme.spacing.lg,
    top: theme.spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 4,
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
  },
  selectionContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  formContainer: {
    paddingVertical: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSizes.xxl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  mainButton: {
    width: '100%',
    marginBottom: theme.spacing.md,
    height: 56,
  },
  buttonText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.background,
  },
  outlineButtonText: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  infoText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSizes.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  authMethodContainer: {
    marginBottom: theme.spacing.md,
  },
  authMethodLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.regular,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xxs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  toggleOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
  },
  toggleTextActive: {
    color: theme.colors.background,
    fontFamily: theme.fonts.bold,
  },
  pinSection: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  pinLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.regular,
  },
  biometricInfo: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    lineHeight: 18,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    height: 56,
  },
  loginButtonText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.bold,
  },
});
