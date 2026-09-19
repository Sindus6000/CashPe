import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Coins, CheckCircle } from "phosphor-react-native";
import { haptic } from "@/src/utils/haptics";

import { api } from "@/src/api/client";
import { rupee } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function Rewards() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const cardsQ = useQuery({ queryKey: ["scratchcards"], queryFn: () => api.get("/scratchcards") });
  const cards = cardsQ.data ?? [];
  const scratched = cards.filter((c: any) => c.scratched);
  const pending = cards.filter((c: any) => !c.scratched);
  const totalEarned = scratched.reduce((s: number, c: any) => s + (c.amount ?? 0), 0);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.brandSecondary, colors.goldDeep]} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>Total Cashback Earned</Text>
            <Text style={styles.headerValue} testID="total-earned">{rupee(totalEarned)}</Text>
          </View>
          <View style={styles.trophy}>
            <Coins size={30} color="#FFFFFF" weight="fill" />
          </View>
        </View>
        {pending.length > 0 && (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>🎁 {pending.length} scratch card{pending.length > 1 ? "s" : ""} waiting for you!</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing["2xl"], paddingHorizontal: spacing.xl }}
        refreshControl={<RefreshControl refreshing={cardsQ.isRefetching} onRefresh={() => cardsQ.refetch()} tintColor={colors.brand} />}
      >
        {cards.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Gift size={48} color={colors.goldDeep} weight="fill" />
            </View>
            <Text style={styles.emptyTitle}>No scratch cards yet</Text>
            <Text style={styles.emptyText}>Make a recharge or pay a bill to win guaranteed cashback!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>All scratch cards</Text>
            <View style={styles.grid}>
              {cards.map((c: any) => {
                if (!c.scratched) {
                  return (
                    <Pressable
                      key={c.id}
                      testID={`reward-card-${c.id}`}
                      style={styles.cardWrap}
                      onPress={() => {
                        haptic.select();
                        router.push({ pathname: "/scratch/[id]", params: { id: c.id } });
                      }}
                    >
                      <LinearGradient colors={[colors.brandSecondary, colors.goldDeep]} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Gift size={38} color="#FFFFFF" weight="fill" />
                        <Text style={styles.cardTapText}>Tap to scratch</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                }
                return (
                  <View key={c.id} style={styles.cardWrap} testID={`reward-card-${c.id}`}>
                    <View style={styles.cardRevealed}>
                      <CheckCircle size={22} color={colors.success} weight="fill" />
                      <Text style={styles.wonLabel}>You won</Text>
                      <Text style={styles.wonAmount}>{rupee(c.amount)}</Text>
                      <Text style={styles.wonOperator} numberOfLines={1}>{c.operator}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
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
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLabel: { color: "#FFFFFF", opacity: 0.95, fontSize: 14, fontWeight: "600" },
  headerValue: { color: "#FFFFFF", fontSize: 38, fontWeight: "900", marginTop: 4 },
  trophy: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    marginTop: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  pendingText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: colors.onSurface, marginTop: spacing.sm },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.xl },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardWrap: { width: "48%", marginBottom: spacing.lg, borderRadius: 20, overflow: "hidden" },
  card: { height: 150, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  cardTapText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  cardRevealed: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  wonLabel: { fontSize: 12, color: colors.muted, fontWeight: "600", marginTop: 4 },
  wonAmount: { fontSize: 26, fontWeight: "900", color: colors.brandDeep },
  wonOperator: { fontSize: 12, color: colors.muted, marginTop: 2 },
}));
