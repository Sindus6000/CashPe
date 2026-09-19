import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { CaretLeft, CheckCircle, CircleIcon, X, Bank, CreditCard, Wallet as WalletIcon } from "phosphor-react-native";
import { haptic } from "@/src/utils/haptics";

import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useAuth } from "@/src/auth/auth-context";
import { SERVICES, OPERATORS, plansFor, validityToDays, defaultValidity, type ServiceType } from "@/src/constants/catalog";
import { OperatorAvatar, ServiceIcon } from "@/src/components/service-visuals";
import { GradientButton } from "@/src/components/gradient-button";
import { rupee } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function ServiceScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { type, account: accountParam, operatorId: operatorParam } =
    useLocalSearchParams<{ type: ServiceType; account?: string; operatorId?: string }>();

  const service = SERVICES.find((s) => s.type === type) ?? SERVICES[0];
  const operators = OPERATORS[service.type];
  const plans = plansFor(service.type);

  const [operatorId, setOperatorId] = useState<string | null>(operatorParam ?? null);
  const [account, setAccount] = useState(accountParam ?? "");
  const [planIndex, setPlanIndex] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [bill, setBill] = useState<any>(null);
  const [method, setMethod] = useState<"cashfree" | "wallet">("cashfree");
  const [error, setError] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");

  const operator = operators.find((o) => o.id === operatorId) ?? null;

  const amount = useMemo(() => {
    if (service.needsBillFetch) return bill?.bill_amount ?? 0;
    if (planIndex !== null) return plans[planIndex].amount;
    return Number(customAmount) || 0;
  }, [service.needsBillFetch, bill, planIndex, plans, customAmount]);

  const fetchBill = useMutation({
    mutationFn: () =>
      api.post("/bill/fetch", { service_type: service.type, operator: operator?.name, account }),
    onSuccess: (data) => {
      setBill(data);
      setError("");
      haptic.select();
    },
    onError: (e: Error) => setError(e.message),
  });

  const pay = useMutation({
    mutationFn: (payload: any) => api.post("/pay", payload),
    onSuccess: (data) => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["scratchcards"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-master"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      setPinModal(false);
      setPin("");
      router.replace({ pathname: "/scratch/[id]", params: { id: data.scratch_card_id } });
    },
    onError: (e: Error) => {
      setError(e.message);
      setPinModal(false);
      setPin("");
    },
  });

  const validAccount = account.trim().length >= 3;
  const canPay = !!operator && validAccount && amount > 0;

  const doPay = (enteredPin?: string) => {
    setError("");
    let validity_days: number;
    let validity_label: string;
    if (service.hasPlans && planIndex !== null) {
      validity_days = validityToDays(plans[planIndex].validity);
      validity_label = `${plans[planIndex].validity} validity`;
    } else {
      const d = defaultValidity(service.type);
      validity_days = d.days;
      validity_label = d.label;
    }
    pay.mutate({
      service_type: service.type,
      operator: operator?.name,
      account: account.trim(),
      amount,
      plan_label:
        planIndex !== null
          ? `${operator?.name} • ₹${plans[planIndex].amount} plan`
          : `${operator?.name} ${service.needsBillFetch ? "bill" : "recharge"}`,
      payment_method: method,
      pin: enteredPin,
      validity_days,
      validity_label,
    });
  };

  const onPayPress = () => {
    if (!canPay) return;
    if (method === "wallet") {
      if (!user?.has_pin) {
        setError("Set a wallet PIN in Profile first");
        return;
      }
      setPinModal(true);
    } else {
      doPay();
    }
  };

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="service-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <View style={styles.headerTitleRow}>
          <ServiceIcon type={service.type} size={20} color={colors.brandDeep} />
          <Text style={styles.headerTitle}>{service.label}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Select Operator</Text>
        <View style={styles.operatorList}>
          {operators.map((op) => {
            const active = operatorId === op.id;
            return (
              <Pressable
                key={op.id}
                testID={`operator-${op.id}`}
                style={[styles.operatorRow, active && styles.operatorRowActive]}
                onPress={() => {
                  setOperatorId(op.id);
                  setBill(null);
                  setPlanIndex(null);
                  setError("");
                  haptic.select();
                }}
              >
                <OperatorAvatar short={op.short} color={op.color} size={42} />
                <Text style={styles.operatorName}>{op.name}</Text>
                {active ? (
                  <CheckCircle size={22} color={colors.brand} weight="fill" />
                ) : (
                  <CircleIcon size={22} color={colors.border} weight="bold" />
                )}
              </Pressable>
            );
          })}
        </View>

        {operator && (
          <>
            <Text style={styles.label}>{service.accountLabel}</Text>
            <TextInput
              testID="account-input"
              style={styles.input}
              placeholder={service.accountPlaceholder}
              placeholderTextColor={colors.muted}
              keyboardType={service.keyboard}
              value={account}
              onChangeText={(t) => {
                setAccount(t);
                setBill(null);
                setError("");
              }}
            />

            {/* Bill fetch flow */}
            {service.needsBillFetch && validAccount && !bill && (
              <GradientButton
                testID="fetch-bill-button"
                label="Fetch Bill"
                variant="gold"
                loading={fetchBill.isPending}
                onPress={() => fetchBill.mutate()}
                style={{ marginTop: spacing.lg }}
              />
            )}

            {service.needsBillFetch && bill && (
              <View style={styles.billCard} testID="bill-card">
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Consumer</Text>
                  <Text style={styles.billValue}>{bill.consumer_name}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Bill period</Text>
                  <Text style={styles.billValue}>{bill.bill_period}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Due date</Text>
                  <Text style={styles.billValue}>{bill.due_date}</Text>
                </View>
                <View style={[styles.billRow, styles.billTotal]}>
                  <Text style={styles.billTotalLabel}>Amount payable</Text>
                  <Text style={styles.billTotalValue}>{rupee(bill.bill_amount)}</Text>
                </View>
              </View>
            )}

            {/* Plans (mobile / dth) */}
            {service.hasPlans && validAccount && (
              <>
                <Text style={styles.label}>Choose a Plan</Text>
                <View style={styles.planList}>
                  {plans.map((p, i) => {
                    const active = planIndex === i;
                    return (
                      <Pressable
                        key={i}
                        testID={`plan-${p.amount}`}
                        style={[styles.planRow, active && styles.planRowActive]}
                        onPress={() => {
                          setPlanIndex(i);
                          setCustomAmount("");
                          haptic.select();
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planDesc}>{p.desc}</Text>
                          <Text style={styles.planValidity}>Validity: {p.validity}</Text>
                        </View>
                        <Text style={[styles.planAmount, active && { color: colors.brandDeep }]}>₹{p.amount}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Or enter amount</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountPrefix}>₹</Text>
                  <TextInput
                    testID="custom-amount-input"
                    style={styles.amountInput}
                    placeholder="Custom amount"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={customAmount}
                    onChangeText={(t) => {
                      setCustomAmount(t.replace(/[^0-9]/g, ""));
                      setPlanIndex(null);
                    }}
                  />
                </View>
              </>
            )}

            {/* Payment method */}
            {amount > 0 && (
              <>
                <Text style={styles.label}>Payment Method</Text>
                <Pressable
                  testID="method-cashfree"
                  style={[styles.methodRow, method === "cashfree" && styles.methodActive]}
                  onPress={() => setMethod("cashfree")}
                >
                  <CreditCard size={22} color={colors.brandDeep} weight="fill" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Cashfree (UPI / Card)</Text>
                    <Text style={styles.methodSub}>Pay securely — demo mode</Text>
                  </View>
                  {method === "cashfree" ? (
                    <CheckCircle size={20} color={colors.brand} weight="fill" />
                  ) : (
                    <CircleIcon size={20} color={colors.border} weight="bold" />
                  )}
                </Pressable>
                <Pressable
                  testID="method-wallet"
                  style={[styles.methodRow, method === "wallet" && styles.methodActive]}
                  onPress={() => setMethod("wallet")}
                >
                  <WalletIcon size={22} color={colors.brandDeep} weight="fill" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>CashPe Wallet</Text>
                    <Text style={styles.methodSub}>Requires 4-digit PIN</Text>
                  </View>
                  {method === "wallet" ? (
                    <CheckCircle size={20} color={colors.brand} weight="fill" />
                  ) : (
                    <CircleIcon size={20} color={colors.border} weight="bold" />
                  )}
                </Pressable>
              </>
            )}

            {!!error && <Text style={styles.error} testID="service-error">{error}</Text>}
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Sticky pay bar */}
      {canPay && (
        <View style={[styles.payBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <View>
            <Text style={styles.payBarLabel}>Amount</Text>
            <Text style={styles.payBarAmount}>{rupee(amount)}</Text>
          </View>
          <GradientButton
            testID="pay-button"
            label={`Pay ${rupee(amount)}`}
            loading={pay.isPending}
            onPress={onPayPress}
            style={{ flex: 1, marginLeft: spacing.lg }}
          />
        </View>
      )}

      {/* PIN modal for wallet payment */}
      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <View style={styles.pinBackdrop}>
          <View style={styles.pinCard}>
            <View style={styles.pinHeader}>
              <View style={styles.pinIcon}>
                <Bank size={22} color={colors.onBrand} weight="fill" />
              </View>
              <Pressable testID="close-pin" onPress={() => setPinModal(false)} hitSlop={10}>
                <X size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <Text style={styles.pinTitle}>Enter Wallet PIN</Text>
            <Text style={styles.pinSub}>Confirm payment of {rupee(amount)}</Text>
            <TextInput
              testID="wallet-pin-input"
              style={styles.pinInput}
              placeholder="••••"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ""))}
              autoFocus
            />
            {pay.isPending ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
            ) : (
              <GradientButton
                testID="confirm-pin-pay"
                label="Confirm & Pay"
                disabled={pin.length !== 4}
                onPress={() => doPay(pin)}
                style={{ marginTop: spacing.lg }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 14, fontWeight: "800", color: colors.onSurfaceSecondary, marginTop: spacing.xl, marginBottom: spacing.md },
  operatorList: { gap: spacing.sm },
  operatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  operatorRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  operatorName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "600",
  },
  billCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  billRow: { flexDirection: "row", justifyContent: "space-between" },
  billLabel: { color: colors.muted, fontSize: 13 },
  billValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  billTotal: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  billTotalLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  billTotalValue: { color: colors.brandDeep, fontSize: 18, fontWeight: "900" },
  planList: { gap: spacing.sm },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  planRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  planDesc: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  planValidity: { fontSize: 12, color: colors.muted, marginTop: 3 },
  planAmount: { fontSize: 18, fontWeight: "900", color: colors.onSurface },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountPrefix: { fontSize: 20, fontWeight: "900", color: colors.onSurface, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  methodActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  methodTitle: { fontSize: 14.5, fontWeight: "800", color: colors.onSurface },
  methodSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  error: { color: colors.error, marginTop: spacing.lg, fontWeight: "600", textAlign: "center" },
  payBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payBarLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  payBarAmount: { fontSize: 22, fontWeight: "900", color: colors.onSurface },
  pinBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  pinCard: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl },
  pinHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pinIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  pinTitle: { fontSize: 20, fontWeight: "900", color: colors.onSurface, marginTop: spacing.lg },
  pinSub: { fontSize: 14, color: colors.muted, marginTop: 4 },
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
    marginTop: spacing.xl,
  },
}));
