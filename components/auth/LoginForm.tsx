
import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import * as WebBrowser from 'expo-web-browser';
import { Text } from "../ui/text";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { StoredUsersView } from "./StoredUsersView";
import { theme } from "~/lib/theme";
import { hasDeviceAuthentication } from '~/lib/secure-key';
import type { EncryptionMethod, StoredUser } from '../../lib/types';

interface LoginFormProps {
  username: string;
  password: string;
  message: string;
  onUsernameChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onSubmit: (method: EncryptionMethod, pin?: string) => Promise<void>;
  onSpectator: () => Promise<void>;
  storedUsers?: StoredUser[];
  onQuickLogin?: (username: string, method: EncryptionMethod, pin?: string) => Promise<void>;
  onDeleteUser?: (username: string) => void;
  deletingUser?: string | null;
}

export function LoginForm({
  username,
  password,
  message,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onSpectator,
  storedUsers = [],
  onQuickLogin,
  onDeleteUser,
  deletingUser,
}: LoginFormProps) {
  const [method, setMethod] = useState<EncryptionMethod>('pin');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [quickLoginUser, setQuickLoginUser] = useState<StoredUser | null>(null);
  const [quickPin, setQuickPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [deviceAuth, setDeviceAuth] = useState({
    hasBiometric: false,
    hasDevicePin: false,
    biometricTypes: [] as any[],
  });

  // Check device authentication capabilities on mount
  useEffect(() => {
    const checkDeviceAuth = async () => {
      try {
        const authInfo = await hasDeviceAuthentication();
        setDeviceAuth(authInfo);
        
        // Only enable biometric option if device has biometric authentication
        // User can still choose to use PIN even if biometric is available
        if (authInfo.hasBiometric || authInfo.hasDevicePin) {
          // Device has security - let user choose
          setUseBiometric(false); // Default to PIN, user can toggle to biometric
        } else {
          // Device has no security, force PIN method
          setUseBiometric(false);
        }
      } catch (error) {
        console.error('Error checking device auth:', error);
        // Fallback to PIN method if there's an error
        setUseBiometric(false);
        setDeviceAuth({
          hasBiometric: false,
          hasDevicePin: false,
          biometricTypes: [],
        });
      }
    };
    
    checkDeviceAuth();
  }, []);

  // Update method based on user's biometric preference
  useEffect(() => {
    setMethod(useBiometric ? 'biometric' : 'pin');
  }, [useBiometric]);

  // Determine what to show based on stored users
  const hasStoredUsers = storedUsers.filter(user => user.username !== "SPECTATOR").length > 0;
  const shouldShowNewUserForm = !hasStoredUsers || showNewUserForm;

  // Handle quick login for stored users
  const handleQuickLogin = (user: StoredUser) => {
    setQuickLoginUser(user);
    if (user.method === 'pin') {
      // PIN users always enter PIN
      setShowPinInput(true);
    } else if (user.method === 'biometric' && onQuickLogin) {
      // Biometric users use biometric - no fallback to PIN
      setIsLoading(true);
      onQuickLogin(user.username, user.method).finally(() => setIsLoading(false));
    }
  };

  // Handle PIN submit for quick login
  const handleQuickPinSubmit = async () => {
    if (quickLoginUser && onQuickLogin) {
      setIsLoading(true);
      try {
        await onQuickLogin(quickLoginUser.username, quickLoginUser.method, quickPin);
        setShowPinInput(false);
        setQuickPin('');
        setQuickLoginUser(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle canceling PIN input to go back to user list
  const handleCancelPinInput = () => {
    setShowPinInput(false);
    setQuickPin('');
    setQuickLoginUser(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSubmit(method, pin);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUserPress = () => {
    setShowNewUserForm(true);
  };

  const handleBackToStoredUsers = () => {
    setShowNewUserForm(false);
    // Clear form
    onUsernameChange('');
    onPasswordChange('');
    setPin('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {/* PIN input for quick login - show only this when active */}
      {showPinInput && quickLoginUser && quickLoginUser.method === 'pin' ? (
        <View style={styles.section}>
          <Text style={styles.pinPrompt}>Enter 6-digit PIN for @{quickLoginUser.username}</Text>
          <Input
            placeholder="PIN"
            value={quickPin}
            onChangeText={setQuickPin}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />
          <Button onPress={handleQuickPinSubmit} style={styles.button}>
            <Text>Login</Text>
          </Button>
          <Pressable onPress={handleCancelPinInput} style={styles.backLink}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Show stored users if they exist and we're not showing new user form */}
          {hasStoredUsers && !shouldShowNewUserForm && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Welcome Back</Text>
              <StoredUsersView
                users={storedUsers}
                onQuickLogin={handleQuickLogin}
                onDeleteUser={onDeleteUser}
              />
              {deletingUser && (
                <Text style={styles.deletingText}>Deleting @{deletingUser}...</Text>
              )}
              
              {/* Add user link */}
              <Pressable onPress={handleAddUserPress} style={styles.addUserLink}>
                <Text style={styles.addUserText}>+ Add a new user</Text>
              </Pressable>
            </View>
          )}

          {/* New user form */}
          {shouldShowNewUserForm && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {hasStoredUsers ? 'Add New User' : 'Login with Hive'}
              </Text>
              
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

              {/* Biometric/PIN Toggle - only show if device has biometric capabilities */}
              {(deviceAuth.hasBiometric || deviceAuth.hasDevicePin) && (
                <View style={styles.authMethodContainer}>
                  <Text style={styles.authMethodLabel}>Authentication Method:</Text>
                  <View style={styles.toggleContainer}>
                    <Pressable
                      style={[
                        styles.toggleOption,
                        !useBiometric && styles.toggleOptionActive
                      ]}
                      onPress={() => setUseBiometric(false)}
                    >
                      <Text style={[
                        styles.toggleText,
                        !useBiometric && styles.toggleTextActive
                      ]}>
                        PIN
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.toggleOption,
                        useBiometric && styles.toggleOptionActive
                      ]}
                      onPress={() => setUseBiometric(true)}
                    >
                      <Text style={[
                        styles.toggleText,
                        useBiometric && styles.toggleTextActive
                      ]}>
                        {deviceAuth.hasBiometric ? 'Biometric' : 'Device PIN'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* PIN input - always show when method is PIN */}
              {method === 'pin' && (
                <Input
                  placeholder="Set 6-digit APP PIN"
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  style={styles.input}
                  placeholderTextColor={theme.colors.muted}
                />
              )}

              {/* Biometric info text */}
              {method === 'biometric' && (
                <Text style={styles.biometricInfo}>
                  Your posting key will be secured with {deviceAuth.hasBiometric ? 'biometric authentication' : 'device PIN'}
                </Text>
              )}

              <Button
                onPress={handleSubmit}
                style={[styles.button, styles.loginButton]}
                disabled={isLoading}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Logging in...' : 'Login'}
                </Text>
              </Button>
              
              {hasStoredUsers && (
                <Pressable onPress={handleBackToStoredUsers} style={styles.backLink}>
                  <Text style={styles.backText}>← Back to stored users</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable
            onPress={() => WebBrowser.openBrowserAsync('https://signup.hive.io/')}
            style={styles.createAccountLink}
          >
            <Text style={styles.createAccountText}>
              Click here to create an account
            </Text>
          </Pressable>

          <Pressable
            onPress={onSpectator}
            style={styles.spectatorButton}
          >
            <Text style={styles.spectatorButtonText}>Enter as Spectator</Text>
          </Pressable>
        </>
      )}

      {message ? (
        <Text style={[
          styles.message,
          message.includes('deleted') ? styles.successMessage : styles.errorMessage
        ]}>
          {message}
        </Text>
      ) : null}

      {/* Simple loading indicator instead of full screen overlay */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Authenticating...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSizes.xxxl,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg * 2,
    fontFamily: theme.fonts.bold,
    paddingTop: theme.spacing.sm, // Add padding to prevent cutoff
    lineHeight: 40, // Ensure proper line height
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  deletingText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  addUserLink: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  addUserText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  backLink: {
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  backText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  pinPrompt: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  button: {
    marginTop: theme.spacing.sm,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '500',
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
    lineHeight: 20, // Explicit line height to prevent clipping
  },
  loginButtonText: {
    color: theme.colors.background,
    fontWeight: '500',
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
    lineHeight: 20, // Explicit line height to prevent clipping
  },
  spectatorButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  spectatorButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: '500',
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
    paddingVertical: 4, // Small padding to ensure text isn't clipped
  },
  createAccountLink: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountText: {
    color: theme.colors.primary,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    textDecorationLine: 'underline',
  },
  message: {
    textAlign: 'center',
    marginHorizontal: theme.spacing.lg * 2.5,
    marginTop: theme.spacing.sm,
  },
  successMessage: {
    color: '#22c55e',
  },
  errorMessage: {
    color: '#ef4444',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
  },
  authMethodContainer: {
    marginBottom: theme.spacing.md,
  },
  authMethodLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.regular,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.xxs,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  toggleTextActive: {
    color: theme.colors.background,
    fontFamily: theme.fonts.bold,
  },
  biometricInfo: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
  },
});
