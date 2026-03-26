import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "../ui/text";
import { Button } from "../ui/button";
import { StoredUsersView } from "./StoredUsersView";
import { PinInput } from "../ui/PinInput";
import { theme } from "~/lib/theme";
import { hasDeviceAuthentication } from '~/lib/secure-key';
import type { EncryptionMethod, StoredUser } from '../../lib/types';
import { AddUserDrawer } from "./AddUserDrawer";

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
}: LoginFormProps) {
  const [method, setMethod] = useState<EncryptionMethod>('pin');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [quickLoginUser, setQuickLoginUser] = useState<StoredUser | null>(null);
  const [quickPin, setQuickPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddUserDrawerVisible, setIsAddUserDrawerVisible] = useState(false);
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
        if (authInfo.hasBiometric || authInfo.hasDevicePin) {
          setUseBiometric(false); 
        } else {
          setUseBiometric(false);
        }
      } catch (error) {
        console.error('Error checking device auth:', error);
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

  const hasStoredUsers = storedUsers.filter(user => user.username !== "SPECTATOR").length > 0;
  
  const handleAddUserPress = () => {
    setIsAddUserDrawerVisible(true);
  };

  const handleDrawerClose = () => {
    setIsAddUserDrawerVisible(false);
  };

  const handleQuickLogin = (user: StoredUser) => {
    setQuickLoginUser(user);
    if (user.method === 'pin') {
      setShowPinInput(true);
    } else if (user.method === 'biometric' && onQuickLogin) {
      setIsLoading(true);
      onQuickLogin(user.username, user.method).finally(() => setIsLoading(false));
    }
  };

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

  const handleCancelPinInput = () => {
    setShowPinInput(false);
    setQuickPin('');
    setQuickLoginUser(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSubmit(method, pin);
      setIsAddUserDrawerVisible(false);
      onUsernameChange('');
      onPasswordChange('');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {showPinInput && quickLoginUser && quickLoginUser.method === 'pin' ? (
        <View style={styles.pinSection}>
          <Text style={styles.pinPrompt}>Enter PIN for @{quickLoginUser.username}</Text>
          <PinInput
            value={quickPin}
            onChangeText={setQuickPin}
            onComplete={handleQuickPinSubmit}
            autoFocus
          />
          <Pressable onPress={handleCancelPinInput} style={styles.backLink}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            {hasStoredUsers ? (
              <>
                <StoredUsersView
                  users={storedUsers}
                  onQuickLogin={handleQuickLogin}
                />
                <Button 
                  onPress={handleAddUserPress} 
                  variant="outline" 
                  style={styles.addUserButton}
                >
                  <Text style={styles.addUserButtonText}>+ Add New User</Text>
                </Button>
              </>
            ) : (
              <View style={styles.noUsersContainer}>
                <Text style={styles.noUsersTitle}>No accounts found</Text>
                <Text style={styles.noUsersSubtitle}>Join the skate community on Web3</Text>
                <Button 
                  onPress={handleAddUserPress} 
                  variant="default" 
                  style={styles.mainAddButton}
                >
                  <Text style={styles.mainAddButtonText}>+ Add Hive User</Text>
                </Button>
              </View>
            )}
          </View>

          <Pressable
            onPress={onSpectator}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Enter as Spectator</Text>
          </Pressable>

          <AddUserDrawer 
            isVisible={isAddUserDrawerVisible}
            onClose={handleDrawerClose}
            username={username}
            onUsernameChange={onUsernameChange}
            password={password}
            onPasswordChange={onPasswordChange}
            pin={pin}
            onPinChange={setPin}
            method={method as any}
            onMethodChange={(m) => setUseBiometric(m === 'biometric')}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            deviceAuth={deviceAuth}
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'column',
    gap: 2,
  },
  section: {
    marginBottom: theme.spacing.xs,
  },
  pinSection: {
    marginBottom: 80,
    alignItems: 'center',
  },
  addUserButton: {
    marginTop: theme.spacing.lg,
    borderColor: 'rgba(50, 205, 50, 0.3)',
    borderStyle: 'dashed',
    height: 50,
  },
  addUserButtonText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
  },
  noUsersContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginVertical: theme.spacing.md,
  },
  noUsersTitle: {
    fontSize: theme.fontSizes.lg,
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    marginBottom: theme.spacing.xs,
  },
  noUsersSubtitle: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  mainAddButton: {
    width: '100%',
    height: 56,
  },
  mainAddButtonText: {
    color: theme.colors.background,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
  },
  backLink: {
    marginTop: theme.spacing.xs,
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
  secondaryButton: {
    marginTop: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: '500',
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
  },
  successMessage: {
    color: '#22c55e',
  },
  errorMessage: {
    color: '#ef4444',
  },
});
