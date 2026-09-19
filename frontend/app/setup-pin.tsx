import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { LockKey } from "phosphor-react-native";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { GradientButton } from "@/src/components/gradient-button";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function SetupPin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (name.trim()) await api.post("/auth/profile", { name: name.trim() });
      await api.post("/auth/set-pin", { pin });
    },
    onSuccess: async () => {
      await refreshUser();
      router.replace("/(tabs)");
    },
    onError: (e: Error) => setError(e.message),
  });

  const onSubmit = () => {
    if (!/^\d{4}$/.test(pin)) return setError("Enter a 4-digit PIN");
    if (pin !== confirm) return setError("PINs do not match");
    setError("");
    submit.mutate();
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconBadge}>
          <LockKey size={36} color={colors.onBrand} weight="fill" />
        </View>
        <Text style={styles.title}>Secure your wallet</Text>
        <Text style={styles.subtitle}>
          Set a 4-digit PIN to protect your CashPe wallet payments.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Your Name (optional)</Text>
          <TextInput
            testID="name-input"
            style={styles.input}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Create 4-digit PIN</Text>
          <TextInput
            testID="pin-input"
            style={styles.pinInput}
            placeholder="••••"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={pin}
            onChangeText={(t) => {
              setPin(t.replace(/[^0-9]/g, ""));
              setError("");
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            testID="confirm-pin-input"
            style={styles.pinInput}
            placeholder="••••"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t.replace(/[^0-9]/g, ""));
              setError("");
            }}
          />
        </View>

        {!!error && <Text style={styles.error} testID="pin-error">{error}</Text>}

        <GradientButton
          testID="save-pin-button"
          label="Set PIN & Continue"
          loading={submit.isPending}
          onPress={onSubmit}
          style={{ marginTop: spacing.xl }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  title: { fontSize: 26, fontWeight: "900", color: colors.onSurface, marginTop: spacing.lg },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: spacing.sm, lineHeight: 22 },
  field: { marginTop: spacing.xl },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    height: 60,
    fontSize: 26,
    letterSpacing: 14,
    textAlign: "center",
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "800",
  },
  error: { color: colors.error, marginTop: spacing.lg, fontWeight: "600", textAlign: "center" },
}));
