import { Platform } from "react-native";
import type { VideoPlayer } from "expo-video";

// Android only. ExoPlayer keeps what it downloads in the Java heap (256 MB on
// most phones), and by default each player buffers up to 50 s or ~138 MB, even
// while paused. With the feed keeping several screens of posts mounted, the
// players filled the heap and the app died with OutOfMemoryError, and they all
// downloaded at once, so the clip on screen started slowly.
// iOS buffers outside the app heap and keeps its defaults.
const MB = 1024 * 1024;

export type BufferRole = "active" | "neighbor" | "idle";

const ANDROID_BUFFER: Record<BufferRole, { preferredForwardBufferDuration: number; maxBufferBytes: number }> = {
  // The clip on screen.
  active: { preferredForwardBufferDuration: 20, maxBufferBytes: 24 * MB },
  // The next swipe, so it can start right away.
  neighbor: { preferredForwardBufferDuration: 5, maxBufferBytes: 6 * MB },
  // Mounted but off screen: download nothing.
  idle: { preferredForwardBufferDuration: 0, maxBufferBytes: 1 * MB },
};

export function setAndroidBuffer(player: VideoPlayer, role: BufferRole) {
  if (Platform.OS !== "android") return;
  try {
    player.bufferOptions = ANDROID_BUFFER[role];
  } catch {
    // Player already released during a fast scroll.
  }
}
