import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PinInput } from "~/components/ui/PinInput";
import { AuthBackground } from "~/components/auth/AuthBackground";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { theme } from "~/lib/theme";

// Celebratory clip shown on the "You're in" success screen.
const CELEBRATION = require("../assets/animations/youre-in.mp4");
import {
  requestOtp,
  verifyOtp,
  completeSignup,
  checkUsername,
  type UserbaseUser,
} from "~/lib/userbase/api";
import { useAuth } from "~/lib/auth-provider";

type Step = "email" | "otp" | "username" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `bielcx@gmail.com` → `b•••@gmail.com`, as in the design. */
function maskEmail(address: string): string {
  const [name, domain] = address.split("@");
  if (!domain) return address;
  return `${name.slice(0, 1)}•••@${domain}`;
}

const RESEND_SECONDS = 60;

export default function EmailLoginScreen() {
  const { loginWithUserbase } = useAuth();
  // The entry screen collects the address and hands it over, so arriving with
  // one means the code is already on its way and this opens on the keypad.
  const params = useLocalSearchParams<{ email?: string }>();
  const handedEmail = typeof params.email === "string" ? params.email : "";
  // Arriving with an address means the code is already on its way, so open on
  // the keypad — starting at "email" flashed the send form for a moment first.
  const [step, setStep] = useState<Step>(() =>
    EMAIL_RE.test(handedEmail) ? "otp" : "email"
  );
  const [email, setEmail] = useState(handedEmail);
  const [resendIn, setResendIn] = useState(0);
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [handle, setHandle] = useState("");
  const [user, setUser] = useState<UserbaseUser | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Looping muted celebration clip for the success screen.
  const celebrationPlayer = useVideoPlayer(CELEBRATION, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Live username availability
  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<{ available: boolean; reason?: string } | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
    if (step !== "username") return;
    const name = handle.trim().toLowerCase();
    setAvail(null);
    if (name.length < 3) return;
    const seq = ++checkSeq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await checkUsername(name);
        if (seq !== checkSeq.current) return;
        setAvail({ available: r.valid && r.available, reason: r.reason });
      } catch {
        if (seq === checkSeq.current) setAvail({ available: false, reason: "Couldn't check" });
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [handle, step]);

  const sendCode = async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError("Enter a valid email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await requestOtp(em);
      if (!r.success) throw new Error(r.error || "Could not send code");
      setEmail(em);
      setStep("otp");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
      // If the handed-off send failed there is no code coming, so fall back to
      // the form rather than leaving the user staring at an empty keypad.
      setStep("email");
    } finally {
      setBusy(false);
    }
  };

  // No dedicated resend endpoint exists — requesting a code again is the same
  // call, which is why the cooldown below is the only thing rate-limiting it.
  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setCode("");
    // Clear the rejection too, or the fresh boxes come up red with the old
    // message under them.
    setError(null);
    await sendCode();
  };

  // Sent from the entry screen: fire the request once on arrival so the user
  // lands straight on the keypad.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !handedEmail || !EMAIL_RE.test(handedEmail)) return;
    autoSent.current = true;
    sendCode();
  }, [handedEmail]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await verifyOtp(email, code.trim());
      if (!r.success) throw new Error(r.error || "Invalid code");
      if (r.token && r.user) {
        await loginWithUserbase(r.token, r.user, email);
        setUser(r.user);
        // Clear before leaving the step, or a rejected earlier attempt follows
        // the user onto the success screen.
        setError(null);
        setStep("done");
      } else if (r.signupRequired && r.signupToken) {
        setSignupToken(r.signupToken);
        setError(null);
        setStep("username");
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
      // Wrong code: clear the boxes so the next attempt starts clean, instead
      // of leaving six digits that can't be retried.
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    const name = handle.trim().toLowerCase();
    setBusy(true);
    setError(null);
    try {
      const r = await completeSignup(signupToken, name);
      if (!r.success || !r.token || !r.user) throw new Error(r.error || "Could not create account");
      await loginWithUserbase(r.token, r.user, email);
      setUser(r.user);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Same collage as the screen before it — this used to be flat black with
          a title bar, which broke the flow in half. */}
      <AuthBackground scrim="top" />

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.closeButton}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={26} color={busy ? theme.colors.muted : theme.colors.white} />
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === "email" && (
            <>
              <Text style={styles.label}>Your email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={styles.hint}>We'll send you a 6-digit code. No password, no posting key.</Text>
              <PrimaryButton label="Send code" onPress={sendCode} busy={busy} disabled={!email.trim()} />
            </>
          )}

          {step === "otp" && (
            <>
              <Text style={styles.otpTitle}>Enter the code</Text>
              <Text style={styles.otpSubtitle}>
                sent to <Text style={styles.otpEmail}>{maskEmail(email)}</Text>
              </Text>
              {/* Submits on the sixth digit — see PinInput's onComplete. */}
              <PinInput
                value={code}
                onChangeText={(t) => {
                  if (error) setError(null);
                  setCode(t);
                }}
                onComplete={verify}
                autoFocus
                showDigits
                oneTimeCode
                hasError={!!error}
              />
              {busy && <ActivityIndicator size="small" color={theme.auth.neon} />}
              {/* Right under the boxes: the shared error line at the bottom of
                  the screen sits behind the keypad, so a rejected code showed
                  nothing but a spinner that stopped. */}
              {!!error && !busy && <Text style={styles.otpError}>{error}</Text>}
              <Pressable
                onPress={resend}
                disabled={busy || resendIn > 0}
                hitSlop={12}
                accessibilityRole="button"
              >
                <Text style={styles.resend}>
                  {resendIn > 0 ? (
                    <>
                      Resend in <Text style={styles.resendCount}>0:{String(resendIn).padStart(2, "0")}</Text>
                    </>
                  ) : (
                    "Resend code"
                  )}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setStep("email"); setCode(""); setError(null); }} disabled={busy}>
                <Text style={styles.linkText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          {step === "username" && (
            <>
              <Text style={styles.label}>Choose your SkateHive username</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. tonyhawk"
                placeholderTextColor={theme.colors.muted}
                value={handle}
                onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9.-]/g, ""))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                editable={!busy}
              />
              <View style={styles.availRow}>
                {checking ? (
                  <Text style={styles.hint}>Checking…</Text>
                ) : avail ? (
                  <Text style={[styles.hint, { color: avail.available ? theme.colors.primary : theme.colors.danger }]}>
                    {avail.available ? "✓ Available on Hive" : avail.reason || "Not available"}
                  </Text>
                ) : (
                  <Text style={styles.hint}>3–16 chars, lowercase. Must be free on Hive so you can claim it later.</Text>
                )}
              </View>
              <PrimaryButton
                label="Create account"
                onPress={createAccount}
                busy={busy}
                disabled={!avail?.available}
              />
            </>
          )}

          {step === "done" && (
            <View style={styles.doneBox}>
              <VideoView
                player={celebrationPlayer}
                style={styles.celebration}
                contentFit="contain"
                nativeControls={false}
              />
              <Text style={styles.doneTitle}>You're in</Text>
              <Text style={styles.emailEcho}>@{user?.handle}</Text>
              <Pressable
                style={styles.continueBtn}
                onPress={() => router.replace("/(tabs)/videos")}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text style={styles.continueText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </Pressable>
            </View>
          )}

          {/* The OTP step shows its own message under the boxes. */}
          {error && step !== "otp" ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, (busy || disabled) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.lg, color: theme.colors.text },
  // Content sits under the status bar, where the keypad leaves room for it.
  body: { paddingTop: 62, paddingHorizontal: 24, paddingBottom: 18, gap: 14 },
  closeButton: {
    position: "absolute",
    top: 56,
    left: 18,
    zIndex: 10,
  },
  label: { color: theme.colors.muted, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.sm, marginTop: theme.spacing.sm },
  emailEcho: { color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md, marginBottom: theme.spacing.sm },
  otpTitle: {
    color: theme.colors.white,
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    textAlign: "center",
  },
  otpSubtitle: {
    color: theme.auth.textSecondary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  otpEmail: { color: theme.auth.neon },
  resend: {
    color: theme.auth.textTertiary,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
    marginTop: theme.spacing.md,
  },
  resendCount: { color: theme.auth.neon },
  otpError: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.default,
    fontSize: 12,
    textAlign: "center",
  },
  input: {
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
  },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: "center", fontFamily: theme.fonts.bold },
  hint: { color: theme.colors.muted, fontFamily: theme.fonts.regular, fontSize: theme.fontSizes.sm },
  availRow: { minHeight: 20, justifyContent: "center" },
  button: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#000", fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md },
  linkText: { color: theme.colors.primary, fontFamily: theme.fonts.regular, fontSize: theme.fontSizes.sm, textAlign: "center", marginTop: theme.spacing.md },
  errorText: { color: theme.colors.danger, fontFamily: theme.fonts.regular, fontSize: theme.fontSizes.sm, marginTop: theme.spacing.md, textAlign: "center" },
  doneBox: { alignItems: "center", gap: theme.spacing.sm, paddingTop: theme.spacing.xl },
  doneTitle: { color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.xxl },
  celebration: {
    width: 220,
    height: 220,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: "transparent",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.lg,
    minWidth: 200,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  continueText: {
    color: "#000",
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    letterSpacing: 0.5,
  },
});
