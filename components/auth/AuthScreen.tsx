
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, LayoutAnimation, Platform, UIManager, View, StyleSheet } from 'react-native';
import { AuthError, useAuth } from '~/lib/auth-provider';
import { AccountNotFoundError, HiveError, InvalidKeyError, InvalidKeyFormatError } from '~/lib/hive-utils';
import { MatrixRain } from '../ui/loading-effects/MatrixRain';
import { LoginForm } from './LoginForm';
import { theme } from '~/lib/theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { height } = Dimensions.get('window');

export function AuthScreen() {
  const { storedUsers, login, loginStoredUser, enterSpectatorMode, deleteStoredUser } = useAuth();
  const [deletingUser, setDeletingUser] = React.useState<string | null>(null);
  // Delete a user from stored users and SecureStore
  const handleDeleteUser = async (username: string) => {
    setDeletingUser(username);
    try {
      await deleteStoredUser(username);
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setDeletingUser(null);
    }
  };
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState<'error' | 'success' | 'info'>('error');
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsVisible(true);
  }, []);

  const handleSpectator = async () => {
    try {
      await enterSpectatorMode();

      // Navigate and replace current route to prevent going back to login
      router.replace('/(tabs)/feed');
    } catch (error) {
      console.error('Error entering spectator mode:', error);
      setMessage('Error entering spectator mode');
      setMessageType('error');
    }
  };

  const handleSubmit = async (method: 'biometric' | 'pin', pin?: string) => {
    try {
      if (!username || !password) {
        setMessage('Please enter both username and posting key');
        setMessageType('error');
        return;
      }

      await login(username, password, method, pin);

      // Navigate and replace current route to prevent going back to login
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      // Handle specific error types
      if (error instanceof InvalidKeyFormatError ||
          error instanceof AccountNotFoundError ||
          error instanceof InvalidKeyError ||
          error instanceof AuthError ||
          error instanceof HiveError) {
        setMessage(error.message);
      } else {
        setMessage('An unexpected error occurred');
      }
      
      setMessageType('error');
    }
  };

  // Accept username, method, and optional pin for quick login
  const handleQuickLogin = async (selectedUsername: string, method: 'biometric' | 'pin', pin?: string) => {
    try {
      await loginStoredUser(selectedUsername, pin);
      
      // Navigate and replace current route to prevent going back to login
      router.replace('/(tabs)/feed');
    } catch (error) {
      if (error instanceof InvalidKeyFormatError ||
          error instanceof AccountNotFoundError ||
          error instanceof InvalidKeyError ||
          error instanceof AuthError ||
          error instanceof HiveError) {
        setMessage(error.message);
      } else {
        setMessage('Error with quick login');
      }
      setMessageType('error');
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          opacity: isVisible ? 1 : 0,
          transform: [{ translateY: isVisible ? 0 : height }]
        }
      ]}
    >
      <MatrixRain />
      <View style={styles.content}>
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
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg * 2,
  },
});