
import React, { useState } from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { StoredUsersView } from "./StoredUsersView";
import { LoadingScreen } from "../ui/LoadingScreen";
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
  isDarkColorScheme: boolean;
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
  isDarkColorScheme,
  onDeleteUser,
  deletingUser,
}: LoginFormProps) {
  const [method, setMethod] = useState<EncryptionMethod>('biometric');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [quickLoginUser, setQuickLoginUser] = useState<StoredUser | null>(null);
  const [quickPin, setQuickPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle quick login for stored users
  const handleQuickLogin = (user: StoredUser) => {
    setQuickLoginUser(user);
    if (user.method === 'pin') {
      setShowPinInput(true);
    } else if (onQuickLogin) {
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

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSubmit(method, pin);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="w-full max-w-sm flex flex-col gap-1">
      <Text className="text-4xl font-bold text-center text-foreground mb-8">
        Login
      </Text>

      {/* Stored users quick login with delete */}
      {storedUsers.length > 0 && onQuickLogin && (
        <View className="mb-4">
          <Text className="text-lg font-semibold mb-2">Returning Users</Text>
          <StoredUsersView
            users={storedUsers}
            onQuickLogin={handleQuickLogin}
            isDarkColorScheme={isDarkColorScheme}
            onDeleteUser={onDeleteUser}
          />
          {deletingUser && (
            <Text className="text-xs text-foreground/60 mt-1">Deleting @{deletingUser}...</Text>
          )}
        </View>
      )}

      {/* PIN input for quick login */}
      {showPinInput && quickLoginUser && quickLoginUser.method === 'pin' && (
        <View className="mb-4">
          <Text className="mb-1">Enter 6-digit PIN for @{quickLoginUser.username}</Text>
          <Input
            placeholder="PIN"
            value={quickPin}
            onChangeText={setQuickPin}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            className="bg-foreground/10 px-4 py-3 rounded-lg text-foreground"
            placeholderTextColor={isDarkColorScheme ? "#ffffff80" : "#00000080"}
          />
          <Button onPress={handleQuickPinSubmit} className="mt-2"><Text>Login</Text></Button>
        </View>
      )}

      {/* New login form */}
      <Input
        placeholder="Hive Username"
        value={username}
        onChangeText={onUsernameChange}
        className="bg-foreground/10 px-4 py-3 rounded-lg text-foreground"
        placeholderTextColor={isDarkColorScheme ? "#ffffff80" : "#00000080"}
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
      />
      <Input
        placeholder="Posting Key"
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        className="bg-foreground/10 px-4 py-3 rounded-lg text-foreground"
        placeholderTextColor={isDarkColorScheme ? "#ffffff80" : "#00000080"}
        autoComplete="password"
        textContentType="password"
      />

      {/* Encryption method selection */}
      <View className="flex-row gap-2 mt-2 mb-2">
        <Button
          variant={method === 'biometric' ? 'default' : 'outline'}
          onPress={() => setMethod('biometric')}
        >
          <Text>Biometric</Text>
        </Button>
        <Button
          variant={method === 'pin' ? 'default' : 'outline'}
          onPress={() => setMethod('pin')}
        >
          <Text>PIN</Text>
        </Button>
      </View>

      {/* PIN input for new login if PIN selected */}
      {method === 'pin' && (
        <Input
          placeholder="Set 6-digit PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          className="bg-foreground/10 px-4 py-3 rounded-lg text-foreground"
          placeholderTextColor={isDarkColorScheme ? "#ffffff80" : "#00000080"}
        />
      )}

      <Button
        onPress={handleSubmit}
        className="mt-3 bg-foreground transition-all duration-[20ms] active:scale-[0.975]"
        haptic={"light"}
        disabled={isLoading}
      >
        <Text className="text-background font-medium">{isLoading ? 'Logging in...' : 'Login'}</Text>
      </Button>

      <Button
        onPress={onSpectator}
        variant="ghost"
        className="mt-2"
      >
        <Text>Enter as Spectator</Text>
      </Button>

      {message ? (
        <Text className={`text-center mx-10 ${message.includes('deleted') ? 'text-green-500' : 'text-red-500'}`}>
          {message}
        </Text>
      ) : null}

      {isLoading && <LoadingScreen />}
    </View>
  );
}
