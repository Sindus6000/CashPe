import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth/auth-context";
import { useTheme, makeStyles } from "@/src/theme";

export default function Index() {
  const { loading, token, user } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!token || !user) {
      router.replace("/login");
    } else if (!user.has_pin) {
      router.replace("/setup-pin");
    } else {
      router.replace("/(tabs)");
    }
  }, [loading, token, user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
}));
