import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ArrowUp, ArrowDown, X, Wallet as WalletIcon } from "phosphor-react-native";
import { haptic } from "@/src/utils/haptics";

import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { GradientButton } from "@/src/components/gradient-button";
import { rupee, shortDateTime } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "debit", label: "Payments" },
  { id: "cashback", label: "Cashback" },
  { id: "add_money", label: "Added" },
];

const QUICK = [100, 200, 500, 1000, 2000];

export default function WalletScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => api.get("/wallet") });
  const txnQ = useQuery({ queryKey: ["transactions"], queryFn: () => api.get("/transactions") });

  const addMoney = useMutation({
    mutationFn: () => api.post("/wallet/add", { amount: Number(amount) }),
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setShowAdd(false);
      setAmount("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const txns = (txnQ.data ?? []).filter((t: any) => {
    if (filter === "all") return true;
    if (filter === "debit") return t.type === "debit";
    return t.category === filter;
  });

  const onAdd = () => {
    const n = Number(amount);
    if (!n || n <= 0) return setError("Enter a valid amount");
    setError("");
    addMoney.mutate();
  };

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <LinearGradient colors={[colors.brand, colors.brandDeep]} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerLabel}>Total Wallet Balance</Text>
        <Text style={styles.headerValue} testID="wallet-balance">
          {walletQ.isLoading ? "…" : rupee(walletQ.data?.balance)}
        </Text>
        <Pressable
          testID="add-money-button"
          style={styles.addBtn}
          onPress={() => {
            haptic.select();
            setShowAdd(true);
          }}
        >
          <Plus size={18} color={colors.brandDeep} weight="bold" />
          <Text style={styles.addBtnText}>Add Money</Text>
        </Pressable>
      </LinearGradient>

      {/* Filter chips */}
      <View style={styles.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                testID={`filter-${f.id}`}
                onPress={() => setFilter(f.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing["2xl"], paddingTop: spacing.sm }}
        refreshControl={
          <RefreshControl
            refreshing={txnQ.isRefetching}
            onRefresh={() => {
              walletQ.refetch();
              txnQ.refetch();
            }}
            tintColor={colors.brand}
          />
        }
      >
        {txns.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <WalletIcon size={40} color={colors.muted} />
            </View>
            <Text style={styles.emptyText}>No transactions here yet</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {txns.map((t: any) => {
              const credit = t.type === "credit";
              return (
                <View key={t.id} style={styles.row} testID={`txn-${t.id}`}>
                  <View style={[styles.rowIcon, { backgroundColor: credit ? colors.brandTertiary : colors.surfaceTertiary }]}>
                    {credit ? (
                      <ArrowDown size={20} color={colors.brandDeep} weight="bold" />
                    ) : (
                      <ArrowUp size={20} color={colors.onSurfaceTertiary} weight="bold" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.rowDate}>
                      {t.operator ? `${t.operator} • ` : ""}{shortDateTime(t.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: credit ? colors.success : colors.onSurface }]}>
                    {credit ? "+" : "-"}{rupee(t.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add money modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowAdd(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Money to Wallet</Text>
            <Pressable testID="close-add-money" onPress={() => setShowAdd(false)} hitSlop={10}>
              <X size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.rupeeSign}>₹</Text>
            <TextInput
              testID="add-amount-input"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={(t) => {
                setAmount(t.replace(/[^0-9]/g, ""));
                setError("");
              }}
              autoFocus
            />
          </View>
          <View style={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable key={q} testID={`quick-${q}`} style={styles.quickChip} onPress={() => setAmount(String(q))}>
                <Text style={styles.quickText}>₹{q}</Text>
              </Pressable>
            ))}
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <GradientButton
            testID="confirm-add-money"
            label={`Add ${amount ? rupee(Number(amount)) : "Money"}`}
            loading={addMoney.isPending}
            disabled={!amount}
            onPress={onAdd}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={styles.secureNote}>Payments secured via Cashfree (demo mode)</Text>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "flex-start",
  },
  headerLabel: { color: colors.onBrand, opacity: 0.9, fontSize: 14, fontWeight: "600" },
  headerValue: { color: colors.onBrand, fontSize: 40, fontWeight: "900", marginTop: 4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.onBrand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    marginTop: spacing.lg,
  },
  addBtnText: { color: colors.brandDeep, fontWeight: "800", fontSize: 14 },
  chipWrap: { backgroundColor: colors.surface, paddingVertical: spacing.md },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onBrand },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  list: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 66,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14.5, fontWeight: "700", color: colors.onSurface },
  rowDate: { fontSize: 12, color: colors.muted, marginTop: 3 },
  rowAmount: { fontSize: 16, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: colors.onSurface },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rupeeSign: { fontSize: 32, fontWeight: "900", color: colors.onSurface, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 36, fontWeight: "900", color: colors.onSurface, height: 76 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  quickChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.brandTertiary,
  },
  quickText: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: 13 },
  error: { color: colors.error, marginTop: spacing.md, fontWeight: "600" },
  secureNote: { color: colors.muted, fontSize: 11.5, textAlign: "center", marginTop: spacing.md },
}));
