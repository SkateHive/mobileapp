import React, { useEffect, useState } from "react";
import { Modal, View, Pressable, TextInput, ActivityIndicator, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";

interface Props {
  visible: boolean;
  initialHandle?: string;
  title?: string;
  subtitle?: string;
  saving?: boolean;
  onSave: (handle: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  /**
   * Shows the cross-posting switch. Off by default: this modal is also the
   * first-time handle prompt shown mid-post, where an account-wide setting
   * would be the wrong thing to put in front of someone.
   */
  showCrossPostToggle?: boolean;
  crossPostEnabled?: boolean;
  onCrossPostChange?: (enabled: boolean) => void;
}

/**
 * Cross-platform Instagram-handle input. Reused by the composer first-time
 * prompt, the Edit Profile modal, and the Settings dialog.
 */
export function InstagramHandleModal({
  visible,
  initialHandle = "",
  title = "Tag your Instagram",
  subtitle = "Cross-posts to @skatehive will credit your @handle and invite you as a collaborator.",
  saving = false,
  onSave,
  onRemove,
  onClose,
  showCrossPostToggle = false,
  crossPostEnabled = true,
  onCrossPostChange,
}: Props) {
  const [handle, setHandle] = useState(initialHandle);

  useEffect(() => {
    if (visible) setHandle(initialHandle);
  }, [visible, initialHandle]);

  const sanitized = handle.trim().toLowerCase().replace(/^@+/, "");
  const valid = /^[a-z0-9._]{1,30}$/.test(sanitized);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <View style={styles.header}>
            <Ionicons name="logo-instagram" size={22} color={theme.colors.primary} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.inputRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="yourhandle"
              placeholderTextColor={theme.colors.muted}
              value={handle}
              onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              editable={!saving}
            />
          </View>

          {showCrossPostToggle ? (
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                <Text style={styles.toggleTitle}>Cross-post to Instagram</Text>
                <Text style={styles.toggleHint}>
                  {crossPostEnabled
                    ? "New snaps with media are offered to @skatehive."
                    : "Snaps stay on Hive only."}
                </Text>
              </View>
              <Switch
                value={crossPostEnabled}
                onValueChange={onCrossPostChange}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, (!valid || saving) && styles.disabled]}
            disabled={!valid || saving}
            onPress={() => onSave(sanitized)}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.black} />
            ) : (
              <Text style={styles.primaryText}>Save</Text>
            )}
          </Pressable>

          {initialHandle && onRemove ? (
            <Pressable style={styles.secondaryBtn} disabled={saving} onPress={onRemove}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryBtn} disabled={saving} onPress={onClose}>
              <Text style={styles.skipText}>Not now</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  box: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.colors.secondaryCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  at: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.lg,
    marginRight: theme.spacing.xxs,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.lg,
    paddingVertical: theme.spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  toggleLabel: { flex: 1 },
  toggleTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  toggleHint: {
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.muted,
    marginTop: theme.spacing.xxs,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.black,
  },
  secondaryBtn: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.xs,
  },
  skipText: {
    fontFamily: theme.fonts.default,
    fontSize: theme.fontSizes.md,
    color: theme.colors.muted,
  },
  removeText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.danger,
  },
});
