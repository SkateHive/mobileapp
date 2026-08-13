import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PinInput } from "~/components/ui/PinInput";
import { AuthBackground } from "~/components/auth/AuthBackground";
import { AuthError, useAuth } from "~/lib/auth-provider";
import { hasDeviceAuthentication } from "~/lib/secure-key";
import {
  AccountNotFoundError,
  HiveError,
  InvalidKeyError,
  InvalidKeyFormatError,
} from "~/lib/hive-utils";
import { theme } from "~/lib/theme";
import type { EncryptionMethod } from "~/lib/types";

/**
 * Signing in with a Hive posting key — the advanced path (#60).
 *
 * It used to be the first thing a new user saw. Email leads now, and this is
 * reached from "Sign in with Hive ›" in the footer, for people who already have a
 * Hive account and know what a posting key is.
 */
export default function HiveLoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = React.useState("");
  const [postingKey, setPostingKey] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [method, setMethod] = React.useState<EncryptionMethod>("pin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hasBiometric, setHasBiometric] = React.useState(false);

  React.useEffect(() => {
    hasDeviceAuthentication()
      .then((info) => setHasBiometric(info.hasBiometric || info.hasDevicePin))
      .catch(() => setHasBiometric(false));
  }, []);

  // The key is encrypted at rest either way; this chooses what unlocks it.
  // The PIN is typed twice on purpose: it is set once and never shown again, so
  // a typo here locks the stored key away for good — the only way back would be
  // deleting the account and entering the posting key again.
  const pinsMatch = pin.length === 6 && pin === confirmPin;
  const pinMismatch = confirmPin.length === 6 && pin !== confirmPin;
  const canSubmit =
    !!username.trim() && !!postingKey.trim() && (method === "biometric" || pinsMatch);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setBusy(true);
      setError("");
      await login(username.trim(), postingKey.trim(), method, pin);
      router.replace("/(tabs)/videos");
    } catch (e) {
      const known =
        e instanceof InvalidKeyFormatError ||
        e instanceof AccountNotFoundError ||
        e instanceof InvalidKeyError ||
        e instanceof AuthError ||
        e instanceof HiveError;
      setError(known ? (e as Error).message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Same collage and treatment as the other two sign-in screens. */}
      <AuthBackground scrim="top" />

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backButton}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.white} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Sign in with Hive</Text>
          <Text style={styles.caption}>
            For people who already have a Hive account. Your key is encrypted on
            this device and never leaves it.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor={theme.auth.placeholder}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
          />

          <TextInput
            style={styles.input}
            placeholder="posting key"
            placeholderTextColor={theme.auth.placeholder}
            value={postingKey}
            onChangeText={setPostingKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
          />

          {hasBiometric && (
            <View style={styles.methodRow}>
              {(["pin", "biometric"] as EncryptionMethod[]).map((option) => {
                const active = method === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.methodOption, active && styles.methodOptionActive]}
                    onPress={() => setMethod(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>
                      {option === "pin" ? "Unlock with PIN" : "Unlock with biometrics"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {method === "pin" && (
            <>
              <Text style={styles.caption}>Create a 6-digit PIN</Text>
              <PinInput value={pin} onChangeText={setPin} />

              <Text style={styles.caption}>Type it again</Text>
              <PinInput
                value={confirmPin}
                onChangeText={setConfirmPin}
                hasError={pinMismatch}
              />
              {pinMismatch && (
                <Text style={styles.error}>Those PINs don't match.</Text>
              )}
            </>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              (!canSubmit || busy) && styles.disabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.auth.onNeon} />
            ) : (
              <Text style={styles.primaryLabel}>Sign in</Text>
            )}
          </Pressable>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 62,
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: 18,
    zIndex: 10,
  },
  title: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    textAlign: "center",
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  caption: {
    color: theme.auth.textSecondary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  input: {
    width: "100%",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.surface,
    borderWidth: 1,
    borderColor: theme.auth.neon,
    paddingVertical: 15,
    paddingHorizontal: 22,
    color: theme.colors.white,
    fontFamily: theme.fonts.default,
    fontSize: 15,
  },
  methodRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  methodOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.auth.borderIdle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  methodOptionActive: {
    borderColor: theme.auth.neon,
    backgroundColor: theme.auth.surface,
  },
  methodText: {
    color: theme.auth.textTertiary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
  },
  methodTextActive: { color: theme.auth.neon },
  primaryButton: {
    width: "100%",
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.neon,
    paddingVertical: 15,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.xs,
  },
  primaryButtonPressed: { backgroundColor: theme.auth.neonPressed },
  disabled: { opacity: 0.45 },
  primaryLabel: {
    color: theme.auth.onNeon,
    fontFamily: theme.fonts.bold,
    fontSize: 16,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
  },
});
