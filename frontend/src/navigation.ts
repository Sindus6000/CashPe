import { Platform } from "react-native";

// iOS 26+ gets native tabs; older iOS, Android and web fall back to classic JS Tabs.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
