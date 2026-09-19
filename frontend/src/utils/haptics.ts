import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Platform-safe haptics. On web the enum members are undefined and accessing
// them throws, so we guard every call behind a native check and swallow errors.
export const haptic = {
  select() {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync().catch(() => {});
  },
  medium() {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success() {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackStyle.Success).catch(() => {});
  },
};
