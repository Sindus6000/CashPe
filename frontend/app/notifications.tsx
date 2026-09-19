import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CaretLeft, BellRinging, WarningCircle, Clock, CalendarX, ArrowClockwise, Check } from "phosphor-react-native";

import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { OPERATORS, SERVICES, type ServiceType } from "@/src/constants/catalog";
import { OperatorAvatar } from "@/src/components/service-visuals";
import { rupee, shortDate } from "@/src/utils/format";
import { haptic } from "@/src/utils/haptics";
import { makeStyles, useTheme, spacing } from "@/src/theme";

type Reminder = {
  id: string;
  service_type: ServiceType;
  operator: string;
  account: string;
  amount: number;
  expiry_date: string;
  days_left: number;
  status: "expired" | "today" | "expiring" | "upcoming";
  validity_label?: string;
  title?: string;
};

function statusMeta(r: Reminder, colors: any) {
  if (r.status === "expired")
    return { color: colors.error, Icon: CalendarX, label: `Expired ${Math.abs(r.days_left)}d ago` };
  if (r.status === "today")
    return { color: colors.warning, Icon: WarningCircle, label: "Expires today" };
  if (r.status === "expiring")
    return { color: colors.warning, Icon: Clock, label: `Expires in ${r.days_left}d` };
  return { color: colors.brandDeep, Icon: Clock, label: `${r.days_left}d left` };
}

export default function Notifications() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const remindersQ = useQuery<Reminder[]>({ queryKey: ["reminders"], queryFn: () => api.get("/reminders") });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.post(`/reminders/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const reminders = remindersQ.data ?? [];
  const alerts = reminders.filter((r) => r.status !== "upcoming");
  const upcoming = reminders.filter((r) => r.status === "upcoming");

  const rechargeAgain = (r: Reminder) => {
    haptic.select();
    const opId = OPERATORS[r.service_type]?.find((o) => o.name === r.operator)?.id;
    router.push({
      pathname: "/service/[type]",
      params: { type: r.service_type, account: r.account, operatorId: opId ?? "" },
    });
  };

  const renderRow = (r: Reminder) => {
    const meta = statusMeta(r, colors);
    const op = OPERATORS[r.service_type]?.find((o) => o.name === r.operator);
    const svc = SERVICES.find((s) => s.type === r.service_type);
    const StatusIcon = meta.Icon;
    return (
      <View key={r.id} style={styles.card} testID={`reminder-${r.id}`}>
        <View style={styles.cardTop}>
          <OperatorAvatar short={op?.short ?? r.operator?.slice(0, 2)} color={op?.color ?? colors.brand} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{r.operator}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {svc?.label} • {r.account}
            </Text>
          </View>
          <Pressable
            testID={`dismiss-${r.id}`}
            hitSlop={10}
            style={styles.dismissBtn}
            onPress={() => {
              haptic.select();
              dismiss.mutate(r.id);
            }}
          >
            <Check size={16} color={colors.muted} weight="bold" />
          </Pressable>
        </View>
        <View style={styles.cardMeta}>
          <View style={[styles.statusChip, { backgroundColor: meta.color + "1A" }]}>
            <StatusIcon size={14} color={meta.color} weight="fill" />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.expiryDate}>Valid till {shortDate(r.expiry_date)}</Text>
        </View>
        <Pressable testID={`recharge-again-${r.id}`} style={styles.rechargeBtn} onPress={() => rechargeAgain(r)}>
          <ArrowClockwise size={16} color={colors.onBrand} weight="bold" />
          <Text style={styles.rechargeText}>
            {r.service_type === "electricity" || r.service_type === "broadband" ? "Pay Bill" : "Recharge again"}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="notifications-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}
        refreshControl={<RefreshControl refreshing={remindersQ.isRefetching} onRefresh={() => remindersQ.refetch()} tintColor={colors.brand} />}
      >
        {reminders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <BellRinging size={44} color={colors.brandDeep} weight="fill" />
            </View>
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptyText}>
              We&apos;ll remind you here 3 days before any recharge or bill expires.
            </Text>
          </View>
        ) : (
          <>
            {alerts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Needs attention</Text>
                {alerts.map(renderRow)}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcoming.map(renderRow)}
              </>
            )}
          </>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  cardSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: "800" },
  expiryDate: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  rechargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 12,
    height: 44,
    marginTop: spacing.md,
  },
  rechargeText: { color: colors.onBrand, fontWeight: "800", fontSize: 14 },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: colors.onSurface, marginTop: spacing.sm },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.xl },
}));
