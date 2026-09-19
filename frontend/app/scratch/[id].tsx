import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Coins, X, CheckCircle } from "phosphor-react-native";

import { api } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { ScratchCard } from "@/src/components/scratch-card";
import { Confetti } from "@/src/components/confetti";
import { GradientButton } from "@/src/components/gradient-button";
import { rupee } from "@/src/utils/format";
import { makeStyles, useTheme, spacing } from "@/src/theme";

export default function ScratchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [amount, setAmount] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(false);

  const cardQ = useQuery({
    queryKey: ["scratchcard", id],
    queryFn: () => api.get(`/scratchcards/${id}`),
  });

  const scratch = useMutation({
    mutationFn: () => api.post(`/scratchcards/${id}/scratch`),
    onSuccess: (data) => {
      setAmount(data.amount);
      setConfetti(true);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["scratchcards"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const alreadyScratched = cardQ.data?.scratched;
  const shownAmount = amount ?? (alreadyScratched ? cardQ.data?.amount : null);
  const close = () => router.replace("/(tabs)");

  const prize = (
    <View style={styles.prize}>
      <Coins size={44} color={colors.goldDeep} weight="fill" />
      {shownAmount != null ? (
        <>
          <Text style={styles.prizeWon}>You won</Text>
          <Text style={styles.prizeAmount}>{rupee(shownAmount)}</Text>
          <Text style={styles.prizeNote}>Added to your wallet</Text>
        </>
      ) : (
        <Text style={styles.prizeReveal}>Reward{"\n"}revealed!</Text>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {confetti && <Confetti />}
      <Pressable testID="scratch-close" style={styles.closeBtn} onPress={close} hitSlop={12}>
        <X size={24} color="#FFFFFF" weight="bold" />
      </Pressable>

      <Text style={styles.title}>🎉 Cashback for sure!</Text>
      <Text style={styles.subtitle}>
        {shownAmount != null ? "Congratulations on your reward" : "Scratch the card to reveal your reward"}
      </Text>

      <View style={styles.cardArea} testID="scratch-area">
        {cardQ.isLoading ? (
          <View style={styles.prize}>
            <Coins size={44} color={colors.goldDeep} weight="fill" />
          </View>
        ) : alreadyScratched ? (
          <View style={styles.revealedBox}>{prize}</View>
        ) : (
          <ScratchCard size={280} onReveal={() => scratch.mutate()}>
            {prize}
          </ScratchCard>
        )}
      </View>

      {shownAmount != null && (
        <View style={styles.creditedPill}>
          <CheckCircle size={18} color={colors.onSuccess} weight="fill" />
          <Text style={styles.creditedText}>{rupee(shownAmount)} credited to CashPe wallet</Text>
        </View>
      )}

      <View style={styles.footer}>
        <GradientButton
          testID="scratch-done"
          label={shownAmount != null ? "Awesome, Done!" : "Maybe later"}
          variant={shownAmount != null ? "primary" : "gold"}
          onPress={close}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  closeBtn: { position: "absolute", top: 56, right: spacing.xl, zIndex: 10 },
  title: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", textAlign: "center" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: spacing.sm, marginBottom: spacing["2xl"] },
  cardArea: { alignItems: "center", justifyContent: "center" },
  revealedBox: {
    width: 280,
    height: 280,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.goldLight,
    overflow: "hidden",
  },
  prize: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.goldLight,
  },
  prizeWon: { fontSize: 15, fontWeight: "700", color: colors.onSurfaceTertiary, marginTop: spacing.sm },
  prizeAmount: { fontSize: 44, fontWeight: "900", color: colors.goldDeep },
  prizeNote: { fontSize: 13, color: colors.onSurfaceTertiary, fontWeight: "600" },
  prizeReveal: { fontSize: 24, fontWeight: "900", color: colors.goldDeep, textAlign: "center", marginTop: spacing.sm },
  creditedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    marginTop: spacing["2xl"],
  },
  creditedText: { color: colors.onSuccess, fontWeight: "800", fontSize: 13 },
  footer: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: 48 },
}));
