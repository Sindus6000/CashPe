import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight, Sparkle, Gift, ArrowUp, ArrowDown, Bell, WarningCircle, Clock } from "phosphor-react-native";
import { haptic } from "@/src/utils/haptics";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { SERVICES } from "@/src/constants/catalog";
import { ServiceIcon } from "@/src/components/service-visuals";
import { rupee, shortDateTime } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => api.get("/wallet") });
  const txnQ = useQuery({ queryKey: ["transactions"], queryFn: () => api.get("/transactions") });
  const cardsQ = useQuery({ queryKey: ["scratchcards"], queryFn: () => api.get("/scratchcards") });
  const remindersQ = useQuery({ queryKey: ["reminders"], queryFn: () => api.get("/reminders") });

  const refreshing = walletQ.isRefetching || txnQ.isRefetching || cardsQ.isRefetching;
  const onRefresh = () => {
    walletQ.refetch();
    txnQ.refetch();
    cardsQ.refetch();
    remindersQ.refetch();
  };

  const unscratched = (cardsQ.data ?? []).filter((c: any) => !c.scratched);
  const reminders = remindersQ.data ?? [];
  const alerts = reminders.filter((r: any) => r.status !== "upcoming");
  const alertCount = alerts.length;
  const recentTxns = (txnQ.data ?? []).slice(0, 4);
  const firstName = (user?.name ?? "").split(" ")[0] || "there";

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing["2xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header + Hero wallet card */}
        <LinearGradient colors={[colors.brand, colors.brandDeep]} style={[styles.heroWrap, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hi}>Hi, {firstName} 👋</Text>
              <Text style={styles.subHi}>Welcome back to CashPe</Text>
            </View>
            <Pressable
              testID="home-notifications-bell"
              style={styles.bellBtn}
              hitSlop={8}
              onPress={() => {
                haptic.select();
                router.push("/notifications");
              }}
            >
              <Bell size={22} color={colors.onBrand} weight="fill" />
              {alertCount > 0 && (
                <View style={styles.bellBadge} testID="notif-badge">
                  <Text style={styles.bellBadgeText}>{alertCount > 9 ? "9+" : alertCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>CashPe Wallet Balance</Text>
            <Text style={styles.balanceValue} testID="home-wallet-balance">
              {walletQ.isLoading ? "…" : rupee(walletQ.data?.balance)}
            </Text>
            <View style={styles.balanceActions}>
              <Pressable
                testID="home-add-money"
                style={styles.addBtn}
                onPress={() => {
                  haptic.select();
                  router.push("/(tabs)/wallet");
                }}
              >
                <Plus size={16} color={colors.onBrand} weight="bold" />
                <Text style={styles.addBtnText}>Add Money</Text>
              </Pressable>
              <Pressable
                testID="home-view-history"
                style={styles.historyBtn}
                onPress={() => router.push("/(tabs)/wallet")}
              >
                <Text style={styles.historyBtnText}>History</Text>
                <ArrowRight size={14} color={colors.onBrand} weight="bold" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        {/* Cashback for sure banner */}
        <View style={styles.cashbackBanner} testID="cashback-banner">
          <View style={styles.cashbackIcon}>
            <Sparkle size={26} color={colors.goldDeep} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashbackTitle}>Cashback for sure! 🎉</Text>
            <Text style={styles.cashbackText}>
              Win a guaranteed scratch card on every recharge & bill payment
            </Text>
          </View>
        </View>

        {/* Expiring soon reminders */}
        {alerts.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Expiring soon ⏰</Text>
              <Pressable testID="home-see-reminders" onPress={() => router.push("/notifications")}>
                <Text style={styles.seeAll}>View all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {alerts.slice(0, 6).map((r: any) => {
                const expired = r.status === "expired";
                const c = expired ? colors.error : colors.warning;
                const label = expired
                  ? `Expired ${Math.abs(r.days_left)}d ago`
                  : r.status === "today"
                    ? "Expires today"
                    : `${r.days_left}d left`;
                return (
                  <Pressable
                    key={r.id}
                    testID={`home-reminder-${r.id}`}
                    style={styles.reminderCard}
                    onPress={() => router.push("/notifications")}
                  >
                    <View style={[styles.reminderIcon, { backgroundColor: c + "1A" }]}>
                      {expired ? (
                        <WarningCircle size={18} color={c} weight="fill" />
                      ) : (
                        <Clock size={18} color={c} weight="fill" />
                      )}
                    </View>
                    <Text style={styles.reminderOp} numberOfLines={1}>{r.operator}</Text>
                    <Text style={styles.reminderAcc} numberOfLines={1}>{r.account}</Text>
                    <Text style={[styles.reminderDays, { color: c }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Services grid */}
        <Text style={styles.sectionTitle}>Pay & Recharge</Text>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.type}
              testID={`service-${s.type}`}
              style={styles.gridItem}
              onPress={() => {
                haptic.select();
                router.push({ pathname: "/service/[type]", params: { type: s.type } });
              }}
            >
              <View style={styles.gridIcon}>
                <ServiceIcon type={s.type} color={colors.onBrandTertiary} />
              </View>
              <Text style={styles.gridLabel}>{s.label.split(" ")[0]}</Text>
              <Text style={styles.gridSub}>{s.type === "mobile" || s.type === "dth" ? "Recharge" : "Pay Bill"}</Text>
            </Pressable>
          ))}
        </View>

        {/* Unscratched cards */}
        {unscratched.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Scratch cards waiting 🎁</Text>
              <Pressable onPress={() => router.push("/(tabs)/rewards")}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
            >
              {unscratched.slice(0, 6).map((c: any) => (
                <Pressable
                  key={c.id}
                  testID={`home-card-${c.id}`}
                  style={styles.miniCard}
                  onPress={() => router.push({ pathname: "/scratch/[id]", params: { id: c.id } })}
                >
                  <LinearGradient
                    colors={[colors.brandSecondary, colors.goldDeep]}
                    style={styles.miniCardInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Gift size={30} color="#FFFFFF" weight="fill" />
                    <Text style={styles.miniCardText}>Tap to{"\n"}scratch</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Recent transactions */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          {recentTxns.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/wallet")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.txnList}>
          {recentTxns.length === 0 ? (
            <View style={styles.emptyTxn}>
              <Text style={styles.emptyTxnText}>No transactions yet. Make your first recharge!</Text>
            </View>
          ) : (
            recentTxns.map((t: any) => {
              const credit = t.type === "credit";
              return (
                <View key={t.id} style={styles.txnRow} testID={`home-txn-${t.id}`}>
                  <View style={[styles.txnIcon, { backgroundColor: credit ? colors.brandTertiary : colors.surfaceTertiary }]}>
                    {credit ? (
                      <ArrowDown size={18} color={colors.brandDeep} weight="bold" />
                    ) : (
                      <ArrowUp size={18} color={colors.onSurfaceTertiary} weight="bold" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.txnDate}>{shortDateTime(t.created_at)}</Text>
                  </View>
                  <Text style={[styles.txnAmount, { color: credit ? colors.success : colors.onSurface }]}>
                    {credit ? "+" : "-"}{rupee(t.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  heroWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hi: { color: colors.onBrand, fontSize: 22, fontWeight: "900" },
  subHi: { color: colors.onBrand, opacity: 0.85, fontSize: 13, marginTop: 2 },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.brandDeep,
  },
  bellBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  balanceCard: {
    marginTop: spacing.xl,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 22,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  balanceLabel: { color: colors.onBrand, opacity: 0.9, fontSize: 13, fontWeight: "600" },
  balanceValue: { color: colors.onBrand, fontSize: 38, fontWeight: "900", marginTop: 6 },
  balanceActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  addBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: 13 },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyBtnText: { color: colors.onBrand, fontWeight: "700", fontSize: 13 },
  cashbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    backgroundColor: colors.goldLight,
    borderRadius: 18,
    padding: spacing.lg,
  },
  cashbackIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cashbackTitle: { fontSize: 15, fontWeight: "900", color: colors.goldDeep },
  cashbackText: { fontSize: 12.5, color: colors.onSurfaceTertiary, marginTop: 2, lineHeight: 17 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginRight: spacing.xl,
  },
  seeAll: { color: colors.brandDeep, fontWeight: "700", fontSize: 13, marginTop: spacing.xl },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  gridItem: { width: "25%", alignItems: "center", paddingVertical: spacing.md },
  gridIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  gridLabel: { fontSize: 13, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  gridSub: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  cardRow: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.md },
  reminderCard: {
    width: 132,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  reminderOp: { fontSize: 13.5, fontWeight: "800", color: colors.onSurface },
  reminderAcc: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  reminderDays: { fontSize: 12, fontWeight: "800", marginTop: spacing.sm },
  miniCard: { borderRadius: 18, overflow: "hidden" },
  miniCardInner: {
    width: 104,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: spacing.md,
  },
  miniCardText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12, textAlign: "center" },
  txnList: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  emptyTxn: { padding: spacing.xl, alignItems: "center" },
  emptyTxnText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  txnIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txnTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  txnDate: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: "800" },
}));
