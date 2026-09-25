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
  claimAccount,
  checkUsername,
  type UserbaseUser,
  type UsernameReasonCode,
} from "~/lib/userbase/api";
import { userbaseErrorText, usernameReasonText } from "~/lib/userbase/error-text";
import { authErrorText } from "~/lib/auth-error-text";
import { t } from "~/lib/i18n";
import { useAuth } from "~/lib/auth-provider";
import { useOnboardingStep } from "~/lib/onboarding";
import { validate_posting_key, HiveError } from "~/lib/hive-utils";

type Step = "email" | "otp" | "username" | "claim" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `bielcx@gmail.com` → `b•••@gmail.com`, as in the design. */
function maskEmail(address: string): string {
  const [name, domain] = address.split("@");
  if (!domain) return address;
  return `${name.slice(0, 1)}•••@${domain}`;
}

/** Copy for a `signup/claim` failure, keyed by its machine-readable `code`. */
function claimErrorMessage(handle: string, code?: string): string {
  switch (code) {
    case "invalid_key":
      return t("auth.email.claim_err_invalid_key", { handle });
    case "expired_token":
      return t("auth.email.claim_err_expired");
    case "merge_required":
      return t("auth.email.claim_err_merge");
    case "rate_limited":
      return t("auth.email.claim_err_rate_limited");
    default:
      // chain_unavailable and anything unrecognized.
      return t("auth.email.claim_err_unreachable");
  }
}

const RESEND_SECONDS = 60;

// The catalog holds whole sentences ("sent to {{email}}"); the variable sits in its own
// styled <Text>, so the sentence is rendered around a marker instead of concatenated.
const SLOT = "\uE000";
function aroundSlot(sentence: string): [string, string] {
  const at = sentence.indexOf(SLOT);
  return at < 0 ? [sentence, ""] : [sentence.slice(0, at), sentence.slice(at + SLOT.length)];
}

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
  const usernameInputRef = useRef<TextInput>(null);

  // Claim step: posting key for an existing Hive account. Lives only in this
  // component's state while the step is mounted and is cleared in `finally`
  // after submit and on Back — nothing is written to SecureStore.
  const [postingKey, setPostingKey] = useState("");
  const [claimCode, setClaimCode] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gated on the stored step rather than on "did we just create this account",
  // so someone who signed up before onboarding existed still meets the coach.
  // `ready` matters: before the stored set loads, "not pending" only means "not
  // known yet", and a fast tap on Continue would skip the intro for good.
  const { show: introPending, ready: onboardingReady } = useOnboardingStep("intro");

  // Looping muted celebration clip for the success screen.
  const celebrationPlayer = useVideoPlayer(CELEBRATION, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Live username availability
  const [checking, setChecking] = useState(false);
  // `code` is the server's known reason ("hive_taken", "userbase_taken"...); the screen
  // branches on it and never on the text. `reason` is only for reasons we do not know.
  const [avail, setAvail] = useState<{
    available: boolean;
    reason?: string;
    code?: UsernameReasonCode | "check_failed";
  } | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
    if (step !== "username") return;
    const name = handle.trim().toLowerCase();
    setAvail(null);
    if (name.length < 3) return;
    const seq = ++checkSeq.current;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const r = await checkUsername(name);
        if (seq !== checkSeq.current) return;
        setAvail({ available: r.valid && r.available, reason: r.reason, code: r.reasonCode });
      } catch {
        if (seq === checkSeq.current) setAvail({ available: false, code: "check_failed" });
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [handle, step]);

  const sendCode = async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError(t("auth.email.err_invalid_email"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await requestOtp(em);
      if (!r.success) throw new Error(r.error ?? "");
      setEmail(em);
      setStep("otp");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(userbaseErrorText(e, "auth.email.err_send_code"));
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
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("auth.email.err_enter_6_digits"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await verifyOtp(email, code.trim());
      if (!r.success) throw new Error(r.error ?? "");
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
        setError(t("auth.email.err_unexpected"));
        setCode("");
      }
    } catch (e) {
      setError(userbaseErrorText(e, "auth.email.err_invalid_code"));
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
      if (!r.success || !r.token || !r.user) {
        // A race with check-username: the name became taken between the debounced
        // check and submit. Fall back to the same two branches the live check drives.
        if (r.code === "hive_taken" || r.code === "userbase_taken") {
          setAvail({ available: false, code: r.code });
          return;
        }
        throw new Error(r.error ?? "");
      }
      await loginWithUserbase(r.token, r.user, email);
      setUser(r.user);
      setStep("done");
    } catch (e) {
      setError(userbaseErrorText(e, "auth.email.err_create_account"));
    } finally {
      setBusy(false);
    }
  };

  const pickAnotherName = () => {
    usernameInputRef.current?.focus();
  };

  const startClaim = () => {
    setError(null);
    setStep("claim");
  };

  const backToUsername = () => {
    setPostingKey("");
    setClaimCode(null);
    setError(null);
    setStep("username");
  };

  // Session expired mid-claim: the only way forward is a fresh code.
  const restartFromEmail = () => {
    setPostingKey("");
    setClaimCode(null);
    setError(null);
    setSignupToken("");
    setCode("");
    setStep("email");
  };

  const claimHandleAccount = async () => {
    const name = handle.trim().toLowerCase();
    const key = postingKey.trim();
    setBusy(true);
    setError(null);
    setClaimCode(null);
    try {
      // On-device check first: catches a typo'd key without a network call.
      await validate_posting_key(name, key);
      const r = await claimAccount(signupToken, name, key);
      if (!r.success || !r.token || !r.user) {
        setClaimCode(r.code ?? null);
        setError(claimErrorMessage(name, r.code));
        return;
      }
      await loginWithUserbase(r.token, r.user, email);
      setUser(r.user);
      setError(null);
      setStep("done");
    } catch (e) {
      // Key checks (format, unknown account, wrong key) come from validate_posting_key.
      setError(e instanceof HiveError ? authErrorText(e, { username: name }) : userbaseErrorText(e, "auth.email.err_claim_account"));
    } finally {
      // Never persisted; drop it whether the claim succeeded, failed, or threw.
      setPostingKey("");
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
        accessibilityLabel={t("common.close")}
      >
        <Ionicons name="close" size={26} color={busy ? theme.colors.muted : theme.colors.white} />
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === "email" && (
            <>
              <Text style={styles.label}>{t("auth.email.your_email")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("auth.email.placeholder")}
                placeholderTextColor={theme.colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={styles.hint}>{t("auth.email.hint")}</Text>
              <PrimaryButton label={t("auth.email.send_code")} onPress={sendCode} busy={busy} disabled={!email.trim()} />
            </>
          )}

          {step === "otp" && (
            <>
              <Text style={styles.otpTitle}>{t("auth.email.enter_code")}</Text>
              <Text style={styles.otpSubtitle}>
                {aroundSlot(t("auth.email.sent_to", { email: SLOT }))[0]}
                <Text style={styles.otpEmail}>{maskEmail(email)}</Text>
                {aroundSlot(t("auth.email.sent_to", { email: SLOT }))[1]}
              </Text>
              {/* Submits on the sixth digit — see PinInput's onComplete. */}
              <PinInput
                value={code}
                onChangeText={(text) => {
                  if (error) setError(null);
                  setCode(text);
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
                      {aroundSlot(t("auth.email.resend_in", { time: SLOT }))[0]}
                      <Text style={styles.resendCount}>0:{String(resendIn).padStart(2, "0")}</Text>
                      {aroundSlot(t("auth.email.resend_in", { time: SLOT }))[1]}
                    </>
                  ) : (
                    t("auth.email.resend")
                  )}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setStep("email"); setCode(""); setError(null); }} disabled={busy}>
                <Text style={styles.linkText}>{t("auth.email.use_different_email")}</Text>
              </Pressable>
            </>
          )}

          {step === "username" && (
            <>
              <Text style={styles.label}>{t("auth.email.choose_username")}</Text>
              <TextInput
                ref={usernameInputRef}
                style={styles.input}
                placeholder={t("auth.email.username_placeholder")}
                placeholderTextColor={theme.colors.muted}
                value={handle}
                onChangeText={(text) => setHandle(text.toLowerCase().replace(/[^a-z0-9.-]/g, ""))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                editable={!busy}
              />
              <View style={styles.availRow}>
                {checking ? (
                  <Text style={styles.hint}>{t("auth.email.checking")}</Text>
                ) : avail ? (
                  <Text style={[styles.hint, { color: avail.available ? theme.colors.primary : theme.colors.danger }]}>
                    {avail.available
                      ? t("auth.email.available")
                      : avail.code === "check_failed"
                        ? t("auth.email.reason_could_not_check")
                        : usernameReasonText(avail.code, avail.reason)}
                  </Text>
                ) : (
                  <Text style={styles.hint}>{t("auth.email.username_hint")}</Text>
                )}
              </View>
              {avail?.code === "hive_taken" ? (
                <>
                  <PrimaryButton label={t("auth.email.this_account_is_mine")} onPress={startClaim} busy={false} disabled={busy} />
                  <Pressable onPress={pickAnotherName} disabled={busy} hitSlop={12}>
                    <Text style={styles.linkText}>{t("auth.email.pick_another_name")}</Text>
                  </Pressable>
                </>
              ) : avail?.code === "userbase_taken" ? (
                <Pressable onPress={pickAnotherName} disabled={busy} hitSlop={12}>
                  <Text style={styles.linkText}>{t("auth.email.pick_another_name")}</Text>
                </Pressable>
              ) : (
                <PrimaryButton
                  label={t("auth.email.create_account")}
                  onPress={createAccount}
                  busy={busy}
                  disabled={!avail?.available}
                />
              )}
            </>
          )}

          {step === "claim" && (
            <>
              <Text style={styles.otpTitle}>{t("auth.email.claim_title")}</Text>
              <Text style={styles.emailEcho}>@{handle}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("auth.common.posting_key_placeholder")}
                placeholderTextColor={theme.colors.muted}
                value={postingKey}
                onChangeText={setPostingKey}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={styles.hint}>{t("auth.email.claim_hint")}</Text>
              <PrimaryButton
                label={t("auth.email.claim_button")}
                onPress={claimHandleAccount}
                busy={busy}
                disabled={!postingKey.trim()}
              />
              {claimCode === "expired_token" && (
                <Pressable onPress={restartFromEmail} disabled={busy} hitSlop={12}>
                  <Text style={styles.linkText}>{t("auth.email.request_new_code")}</Text>
                </Pressable>
              )}
              <Pressable onPress={backToUsername} disabled={busy} hitSlop={12}>
                <Text style={styles.linkText}>{t("common.back")}</Text>
              </Pressable>
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
              <Text style={styles.doneTitle}>{t("auth.email.done_title")}</Text>
              <Text style={styles.emailEcho}>@{user?.handle}</Text>
              <Pressable
                style={styles.continueBtn}
                onPress={() =>
                  router.replace(introPending ? "/onboarding" : "/(tabs)/videos")
                }
                disabled={!onboardingReady}
                accessibilityRole="button"
                accessibilityLabel={t("common.continue")}
              >
                <Text style={styles.continueText}>{t("common.continue")}</Text>
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
