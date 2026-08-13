import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as LocalAuthentication from "expo-local-authentication";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { AuthBackground } from "~/components/auth/AuthBackground";
import { StoredUsersView } from "~/components/auth/StoredUsersView";
import { PinInput } from "~/components/ui/PinInput";
import { AuthError, useAuth } from "~/lib/auth-provider";
import {
  AccountNotFoundError,
  HiveError,
  InvalidKeyError,
  InvalidKeyFormatError,
} from "~/lib/hive-utils";
import { prefetchVideoFeed, warmUpVideoAssets } from "~/lib/hooks/useQueries";
import { HIVE_AVATAR_URL } from "~/lib/constants";
import {
  loadLastAccountKind,
  loadLastEmailAccount,
  type LastAccountKind,
  type LastEmailAccount,
} from "~/lib/userbase/session-store";
import { theme } from "~/lib/theme";
import type { StoredUser } from "~/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The way into the app (#60).
 *
 * Email leads and is the only method visible by default; the Hive key form is a
 * quiet footer link to /hive-login. A returning account gets a single
 * biometric button instead of a form. Design: docs/design/login-1b.md.
 */
export default function Index() {
  const {
    isAuthenticated,
    isLoading,
    username: authUsername,
    storedUsers,
    loginStoredUser,
    enterSpectatorMode,
    deleteStoredUser,
  } = useAuth();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();

  // Spectators are technically "authenticated" but can't post and must still be
  // able to reach this screen (e.g. tapping "Log in to add a spot" on the map).
  const isRealUser = isAuthenticated && authUsername !== "SPECTATOR";

  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  // Set by "Switch account": drops the hero card and shows the account list
  // plus the email field, so another account can be picked or added.
  const [switchingAccount, setSwitchingAccount] = React.useState(false);
  const [pinForUser, setPinForUser] = React.useState<StoredUser | null>(null);
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [deletingUser, setDeletingUser] = React.useState<string | null>(null);

  // Prefetch video feed + warm HTTP cache while user is on login screen
  React.useEffect(() => {
    prefetchVideoFeed(queryClient);
    warmUpVideoAssets(queryClient);
  }, [queryClient]);

  React.useEffect(() => {
    // Only auto-advance when this screen itself is focused. Otherwise a deep
    // link (e.g. the map widget entering read-only spectator mode) would flip
    // `isAuthenticated` and yank the user off the map.
    if (isRealUser && isFocused) {
      router.push("/(tabs)/videos");
    }
  }, [isRealUser, isFocused]);

  // Coming back here (logging out, or backing out of the code screen) should
  // land on the account card, never on a half-filled keypad.
  React.useEffect(() => {
    if (isFocused && !isRealUser) {
      setPinForUser(null);
      setPin("");
      setSwitchingAccount(false);
      setMessage("");
    }
  }, [isFocused, isRealUser]);

  // Greet whichever account signed in last. Ranking Hive above email was wrong:
  // logging out of a new email account brought back a Hive account from days
  // ago, because the two are remembered in different places.
  const hiveUser = storedUsers[0];
  const [lastEmail, setLastEmail] = React.useState<LastEmailAccount | null>(null);
  const [lastKind, setLastKind] = React.useState<LastAccountKind | null>(null);
  React.useEffect(() => {
    loadLastEmailAccount().then(setLastEmail).catch(() => {});
    loadLastAccountKind().then(setLastKind).catch(() => {});
  }, []);

  // What this device actually offers, so the button doesn't promise Face ID on
  // a fingerprint phone. Falls back to the generic word when unknown.
  const [biometricLabel, setBiometricLabel] = React.useState("biometrics");
  React.useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
          setBiometricLabel("Face ID");
        else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
          setBiometricLabel("Touch ID");
      })
      .catch(() => {});
  }, []);

  const emailWins = lastKind === "email" && !!lastEmail;
  const heroUser = emailWins ? undefined : hiveUser;
  const showHero = !!heroUser && !switchingAccount;
  const showEmailHero = !showHero && !!lastEmail && !switchingAccount;

  const signIn = async (user: StoredUser, enteredPin?: string) => {
    try {
      setBusy(true);
      setMessage("");
      await loginStoredUser(user.username, enteredPin);
      // Clear before leaving: this screen is reused when the user logs out, and
      // a PIN left in state re-fires PinInput's onComplete the moment the pad
      // remounts — signing straight back in, with no way to reach the login.
      setPinForUser(null);
      setPin("");
      router.replace("/(tabs)/videos");
    } catch (error) {
      const known =
        error instanceof InvalidKeyFormatError ||
        error instanceof AccountNotFoundError ||
        error instanceof InvalidKeyError ||
        error instanceof AuthError ||
        error instanceof HiveError;
      setMessage(known ? (error as Error).message : "Could not sign in");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  // Biometric accounts unlock on the tap itself; PIN accounts need the keypad
  // first, which is the design's stated fallback.
  const handleHeroPress = () => {
    if (!heroUser) return;
    if (heroUser.method === "pin") setPinForUser(heroUser);
    else signIn(heroUser);
  };

  const handleSpectator = async () => {
    try {
      await enterSpectatorMode();
      router.replace("/(tabs)/videos");
    } catch {
      setMessage("Could not enter as spectator");
    }
  };

  const handleDeleteUser = async (username: string) => {
    setDeletingUser(username);
    try {
      await deleteStoredUser(username);
    } finally {
      setDeletingUser(null);
    }
  };

  const emailValid = EMAIL_RE.test(email.trim());

  // The address travels to the OTP screen, which sends the code on arrival —
  // so the field on this screen and the code screen are one continuous flow.
  const handleContinue = () => {
    if (!emailValid) return;
    router.push(`/email-login?email=${encodeURIComponent(email.trim())}`);
  };

  if (isLoading || isRealUser) {
    return (
      <View style={styles.container}>
        <AuthBackground />
      </View>
    );
  }

  const footer = (
    <View style={styles.footer}>
      <Pressable onPress={handleSpectator} hitSlop={12}>
        <Text style={styles.spectator}>Spectator</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/hive-login")} hitSlop={12}>
        <Text style={styles.hiveLink}>Sign in with Hive ›</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <AuthBackground />

      <Pressable onPress={() => router.push("/about")} style={styles.infoButton} hitSlop={8}>
        <View style={styles.infoButtonContent}>
          <Ionicons name="information-circle-outline" size={24} color="#ffffff" />
        </View>
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Empty on purpose: the collage already carries the brand, and a
              logo on top of it was two marks fighting each other. This just
              holds the controls at the bottom. */}
          <View style={styles.topSpace} />

          {pinForUser ? (
            <View style={styles.block}>
              <Text style={styles.pinPrompt}>PIN for @{pinForUser.username}</Text>
              <PinInput
                value={pin}
                onChangeText={setPin}
                onComplete={(entered) => signIn(pinForUser, entered)}
                autoFocus
              />
              <Pressable
                onPress={() => {
                  setPinForUser(null);
                  setPin("");
                }}
                hitSlop={12}
              >
                <Text style={styles.switchAccount}>Back</Text>
              </Pressable>
            </View>
          ) : showEmailHero ? (
            <View style={styles.block}>
              <Image
                source={{ uri: `${HIVE_AVATAR_URL}/${lastEmail!.handle}/avatar` }}
                style={styles.avatar}
                contentFit="cover"
              />
              <Text style={styles.heroUsername}>@{lastEmail!.handle}</Text>

              {/* No credential is kept for an email account, so the fastest
                  path back in is a fresh code to the address we remember. */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={() =>
                  router.push(`/email-login?email=${encodeURIComponent(lastEmail!.email)}`)
                }
                accessibilityRole="button"
              >
                <Ionicons name="mail-outline" size={20} color={theme.auth.onNeon} />
                <Text style={styles.primaryLabel}>Continue with email</Text>
              </Pressable>

              <Pressable onPress={() => setSwitchingAccount(true)} hitSlop={12}>
                <Text style={styles.switchAccount}>Switch account</Text>
              </Pressable>
            </View>
          ) : showHero ? (
            <View style={styles.block}>
              <Image
                source={{ uri: `${HIVE_AVATAR_URL}/${heroUser.username}/avatar` }}
                style={styles.avatar}
                contentFit="cover"
              />
              <Text style={styles.heroUsername}>@{heroUser.username}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  busy && styles.disabled,
                ]}
                onPress={handleHeroPress}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator size="small" color={theme.auth.onNeon} />
                ) : (
                  <>
                    {/* Ionicons, not lucide: this is the app's first screen,
                        and in dev Metro loads lucide's whole icon index before
                        anything here renders — including the video. The icon
                        follows the method, or it promises the wrong thing. */}
                    <Ionicons
                      name={heroUser.method === "pin" ? "keypad-outline" : "scan-outline"}
                      size={20}
                      color={theme.auth.onNeon}
                    />
                    <Text style={styles.primaryLabel}>
                      {heroUser.method === "pin"
                        ? "Sign in with PIN"
                        : `Sign in with ${biometricLabel}`}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => setSwitchingAccount(true)} hitSlop={12}>
                <Text style={styles.switchAccount}>Switch account</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.block}>
              {(storedUsers.length > 0 || !!lastEmail) && (
                <View style={styles.accountList}>
                  {/* The remembered email account belongs in this list too — it
                      only vanished because the list knows about Hive accounts,
                      which is where the key lives. */}
                  {!!lastEmail && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.emailRow,
                        pressed && styles.emailRowPressed,
                      ]}
                      onPress={() =>
                        router.push(
                          `/email-login?email=${encodeURIComponent(lastEmail.email)}`
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Continue as ${lastEmail.handle}`}
                    >
                      <Image
                        source={{ uri: `${HIVE_AVATAR_URL}/${lastEmail.handle}/avatar` }}
                        style={styles.rowAvatar}
                        contentFit="cover"
                      />
                      <Text style={styles.rowUsername}>@{lastEmail.handle}</Text>
                      <Text style={styles.rowMethod}>Email</Text>
                    </Pressable>
                  )}

                  <StoredUsersView
                    users={storedUsers}
                    onQuickLogin={(user) => {
                      if (user.method === "pin") setPinForUser(user);
                      else signIn(user);
                    }}
                    onDeleteUser={handleDeleteUser}
                  />
                  {deletingUser && (
                    <Text style={styles.caption}>Removing @{deletingUser}…</Text>
                  )}
                </View>
              )}

              <TextInput
                style={styles.emailInput}
                placeholder="you@email.com"
                placeholderTextColor={theme.auth.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleContinue}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  !emailValid && styles.disabled,
                ]}
                onPress={handleContinue}
                disabled={!emailValid}
                accessibilityRole="button"
              >
                <Text style={styles.primaryLabel}>Continue →</Text>
              </Pressable>

              <Text style={styles.caption}>No password — we email you a code</Text>
            </View>
          )}

          {!!message && <Text style={styles.error}>{message}</Text>}

          {footer}
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
  },
  infoButton: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 10,
  },
  infoButtonContent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: theme.borderRadius.full,
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  topSpace: {
    flex: 1,
    minHeight: 140,
  },
  block: {
    gap: 12,
    alignItems: "center",
    width: "100%",
  },
  accountList: {
    width: "100%",
    marginBottom: theme.spacing.sm,
  },
  // Matches StoredUsersView's rows — same pill, same anatomy.
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.surface,
    borderWidth: 1,
    borderColor: theme.auth.borderIdle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.sm,
  },
  emailRowPressed: { borderColor: theme.auth.neon },
  rowAvatar: { width: 32, height: 32, borderRadius: 16 },
  rowUsername: {
    flex: 1,
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  rowMethod: {
    color: theme.auth.textTertiary,
    fontFamily: theme.fonts.default,
    fontSize: 11,
  },
  emailInput: {
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
  primaryButton: {
    width: "100%",
    flexDirection: "row",
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.auth.neon,
    paddingVertical: 15,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: { backgroundColor: theme.auth.neonPressed },
  disabled: { opacity: 0.45 },
  primaryLabel: {
    color: theme.auth.onNeon,
    fontFamily: theme.fonts.bold,
    fontSize: 16,
  },
  caption: {
    color: theme.auth.textSecondary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: theme.auth.neon,
  },
  heroUsername: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 19,
  },
  switchAccount: {
    color: theme.auth.textLight,
    fontFamily: theme.fonts.default,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  pinPrompt: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    marginTop: theme.spacing.md,
  },
  spectator: {
    color: theme.auth.neon,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  hiveLink: {
    color: theme.auth.textTertiary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
});
