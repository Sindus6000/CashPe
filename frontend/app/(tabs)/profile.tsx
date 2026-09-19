import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  User as UserIcon,
  SignOut,
  ShieldCheck,
  Bank,
  Percent,
  Wallet as WalletIcon,
  Info,
} from "phosphor-react-native";
import { haptic } from "@/src/utils/haptics";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { rupee } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => api.get("/wallet") });
  const b2bQ = useQuery({ queryKey: ["b2b-master"], queryFn: () => api.get("/b2b/master") });
  const cardsQ = useQuery({ queryKey: ["scratchcards"], queryFn: () => api.get("/scratchcards") });

  const totalEarned = (cardsQ.data ?? [])
    .filter((c: any) => c.scratched)
    .reduce((s: number, c: any) => s + (c.amount ?? 0), 0);

  const onLogout = async () => {
    haptic.select();
    await signOut();
    router.replace("/login");
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing["2xl"], paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl }}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <UserIcon size={34} color={colors.onBrand} weight="fill" />
          </View>
          <Text style={styles.name}>{user?.name || "CashPe User"}</Text>
          <Text style={styles.phone}>+91 {user?.phone}</Text>
          <View style={styles.verifiedPill}>
            <ShieldCheck size={14} color={colors.brandDeep} weight="fill" />
            <Text style={styles.verifiedText}>OTP verified • PIN protected</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <WalletIcon size={22} color={colors.brandDeep} weight="fill" />
            <Text style={styles.statValue}>{rupee(walletQ.data?.balance)}</Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
          <View style={styles.statBox}>
            <Percent size={22} color={colors.goldDeep} weight="fill" />
            <Text style={styles.statValue}>{rupee(totalEarned)}</Text>
            <Text style={styles.statLabel}>Cashback won</Text>
          </View>
        </View>

        {/* B2B Master Wallet — owner float status */}
        <Text style={styles.sectionTitle}>B2B Working Capital</Text>
        <View style={styles.card}>
          <View style={styles.b2bRow}>
            <View style={styles.b2bIcon}>
              <Bank size={22} color={colors.onBrandTertiary} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.b2bTitle}>Master Wallet Balance</Text>
              <Text style={styles.b2bSub}>Auto-refills to target after every order</Text>
            </View>
            <Text style={styles.b2bValue} testID="b2b-balance">{rupee(b2bQ.data?.balance)}</Text>
          </View>
          <View style={styles.b2bMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Target limit</Text>
              <Text style={styles.metaValue}>{rupee(b2bQ.data?.target_limit)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total refilled</Text>
              <Text style={styles.metaValue}>{rupee(b2bQ.data?.total_refilled)}</Text>
            </View>
          </View>
        </View>

        {/* How cashback works */}
        <Text style={styles.sectionTitle}>How cashback works</Text>
        <View style={styles.infoCard}>
          <Info size={20} color={colors.brandDeep} weight="fill" />
          <Text style={styles.infoText}>
            Every successful payment earns you a guaranteed scratch card. Rewards are
            server-calculated within a safe 50% net-margin cap — so it&apos;s{" "}
            <Text style={{ fontWeight: "800", color: colors.onSurface }}>always cashback for sure</Text>.
          </Text>
        </View>

        <Pressable testID="logout-button" style={styles.logout} onPress={onLogout}>
          <SignOut size={20} color={colors.error} weight="bold" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.version}>CashPe • v1.0 • Demo mode</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "900", color: colors.onSurface, marginTop: spacing.md },
  phone: { fontSize: 14, color: colors.muted, marginTop: 2 },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: spacing.md,
  },
  verifiedText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.onSurface, marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  b2bRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  b2bIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  b2bTitle: { fontSize: 14.5, fontWeight: "800", color: colors.onSurface },
  b2bSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  b2bValue: { fontSize: 18, fontWeight: "900", color: colors.brandDeep },
  b2bMeta: {
    flexDirection: "row",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 12, color: colors.muted },
  metaValue: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  infoCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: 18,
    padding: spacing.lg,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.onSurfaceTertiary, lineHeight: 19 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 15 },
  version: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.lg },
}));
