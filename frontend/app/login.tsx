import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Coins, ShieldCheck, CaretLeft } from "phosphor-react-native";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { GradientButton } from "@/src/components/gradient-button";
import { makeStyles, useTheme, spacing } from "@/src/theme";
import { haptic } from "@/src/utils/haptics";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

  const requestOtp = useMutation({
    mutationFn: () => api.post("/auth/request-otp", { phone }),
    onSuccess: (data) => {
      setPreviewOtp(data.preview_otp ?? null);
      setStep("otp");
      setError("");
      haptic.select();
    },
    onError: (e: Error) => setError(e.message),
  });

  const verifyOtp = useMutation({
    mutationFn: () => api.post("/auth/verify-otp", { phone, otp }),
    onSuccess: async (data) => {
      haptic.success();
      await signIn(data.token, data.user);
      if (!data.user.has_pin) router.replace("/setup-pin");
      else router.replace("/(tabs)");
    },
    onError: (e: Error) => setError(e.message),
  });

  const validPhone = /^\d{10}$/.test(phone);
  const validOtp = /^\d{4}$/.test(otp);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.brandTertiary, colors.surface]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Coins size={40} color={colors.onBrand} weight="fill" />
          </View>
          <Text style={styles.brandName}>CashPe</Text>
          <Text style={styles.tagline}>Recharge, pay bills & win{"\n"}guaranteed cashback every time</Text>

          <View style={styles.assurance}>
            <ShieldCheck size={18} color={colors.brandDeep} weight="fill" />
            <Text style={styles.assuranceText}>Cashback for sure on every payment</Text>
          </View>
        </View>

        <View style={styles.card}>
          {step === "phone" ? (
            <>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.prefix}>+91</Text>
                <TextInput
                  testID="phone-input"
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/[^0-9]/g, ""));
                    setError("");
                  }}
                  autoFocus
                />
              </View>
              {!!error && <Text style={styles.error} testID="login-error">{error}</Text>}
              <GradientButton
                testID="send-otp-button"
                label="Send OTP"
                disabled={!validPhone}
                loading={requestOtp.isPending}
                onPress={() => requestOtp.mutate()}
                style={{ marginTop: spacing.lg }}
              />
              <Text style={styles.terms}>By continuing you agree to CashPe Terms & Privacy Policy</Text>
            </>
          ) : (
            <>
              <Pressable
                testID="otp-back-button"
                style={styles.backRow}
                onPress={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
              >
                <CaretLeft size={16} color={colors.brandDeep} weight="bold" />
                <Text style={styles.backText}>Change number</Text>
              </Pressable>
              <Text style={styles.label}>Enter OTP sent to +91 {phone}</Text>
              <TextInput
                testID="otp-input"
                style={styles.otpInput}
                placeholder="• • • •"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/[^0-9]/g, ""));
                  setError("");
                }}
                autoFocus
              />
              {previewOtp && (
                <View style={styles.demoBanner} testID="demo-otp-banner">
                  <Text style={styles.demoText}>Demo OTP: {previewOtp}</Text>
                </View>
              )}
              {!!error && <Text style={styles.error} testID="otp-error">{error}</Text>}
              <GradientButton
                testID="verify-otp-button"
                label="Verify & Continue"
                disabled={!validOtp}
                loading={verifyOtp.isPending}
                onPress={() => verifyOtp.mutate()}
                style={{ marginTop: spacing.lg }}
              />
              <Pressable
                testID="resend-otp-button"
                onPress={() => requestOtp.mutate()}
                disabled={requestOtp.isPending}
              >
                <Text style={styles.resend}>Didn&apos;t get it? Resend OTP</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  hero: { alignItems: "center", marginTop: spacing["2xl"] },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  brandName: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.onSurface,
    marginTop: spacing.lg,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  assurance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginTop: spacing.xl,
  },
  assuranceText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    height: 56,
  },
  prefix: { fontSize: 17, fontWeight: "800", color: colors.onSurface, marginRight: spacing.md },
  phoneInput: { flex: 1, fontSize: 17, color: colors.onSurface, fontWeight: "600" },
  otpInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    height: 64,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 12,
    color: colors.onSurface,
  },
  demoBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  demoText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 13 },
  error: { color: colors.error, marginTop: spacing.md, fontWeight: "600", fontSize: 13 },
  terms: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: spacing.lg, lineHeight: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md },
  backText: { color: colors.brandDeep, fontWeight: "700", fontSize: 13 },
  resend: { color: colors.brandDeep, fontWeight: "700", textAlign: "center", marginTop: spacing.lg, fontSize: 13 },
}));
