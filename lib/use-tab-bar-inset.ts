import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Extra space the tab bar needs under its icons for the system navigation bar.
 *
 * The app draws edge to edge, and the tab bar has a fixed height, which turns
 * off React Navigation's own inset handling. On Android with the 3-button
 * navigation bar, that bar then sat on top of the tabs and swallowed the taps.
 * iOS keeps its current layout (0 here).
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "android" ? insets.bottom : 0;
}
