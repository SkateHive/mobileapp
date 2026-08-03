import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "~/components/ui/text";
import { theme } from "~/lib/theme";

export interface ActionSheetItem {
  key: string;
  icon: string;
  title: string;
  subtitle?: string;
  variant?: "primary" | "secondary" | "danger";
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string; // e.g. "CREATE"
  subtitle?: string; // e.g. "@juarezsb"
  items: ActionSheetItem[];
  cancelLabel?: string;
}

// Variant-C bottom action sheet (Claude Design): a grabber, a green mono header
// with the handle on the right, large icon-tile rows, and a Cancel button.
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  items,
  cancelLabel = "Cancel",
}: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  // An item's action runs only once this sheet's Modal is gone. iOS silently
  // drops a presentation that starts while another modal is still dismissing,
  // so opening a screen straight from onPress left nothing on screen — and the
  // caller's visibility flag stuck at true, wedging every later modal.
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        friction: 11,
        tension: 90,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  // Runs after React has committed the unmount, so the Modal is out of the tree
  // before whatever the item wants to open tries to present.
  useEffect(() => {
    if (mounted) return;
    const action = pendingAction.current;
    if (!action) return;
    pendingAction.current = null;
    action();
  }, [mounted]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  // Stop row taps from bubbling to the backdrop.
  const swallow = (e: GestureResponderEvent) => e.stopPropagation();

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.fill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + 14, transform: [{ translateY }] }]}
            onStartShouldSetResponder={() => true}
            onResponderStart={swallow}
          >
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            {items.map((item, i) => {
              const variant = item.variant ?? "secondary";
              const danger = variant === "danger";
              return (
                <View key={item.key}>
                  {i > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      // Rows stay pressable through the exit animation; a second
                      // tap would replace the queued action and run something the
                      // user didn't choose last.
                      if (pendingAction.current) return;
                      Haptics.selectionAsync();
                      pendingAction.current = item.onPress;
                      onClose();
                    }}
                  >
                    <View style={[styles.iconTile, styles[`tile_${variant}`]]}>
                      <Ionicons
                        name={item.icon as any}
                        size={26}
                        color={
                          variant === "primary"
                            ? theme.colors.black
                            : danger
                              ? theme.colors.danger
                              : theme.colors.primary
                        }
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, danger && { color: theme.colors.danger }]}>
                        {item.title}
                      </Text>
                      {!!item.subtitle && (
                        <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={danger ? theme.colors.danger : theme.colors.gray}
                    />
                  </Pressable>
                </View>
              );
            })}

            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0d0d0d",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(50,205,50,0.35)",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#555",
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    letterSpacing: 3,
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.gray,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 14,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tile_primary: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  tile_secondary: {
    backgroundColor: "rgba(50,205,50,0.10)",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tile_danger: {
    backgroundColor: "rgba(229,57,53,0.12)",
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.white,
  },
  rowSubtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.gray,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  cancel: {
    marginTop: theme.spacing.md,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.gray,
  },
});
