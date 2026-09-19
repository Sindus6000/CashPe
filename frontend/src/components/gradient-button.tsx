import React from "react";
import { Pressable, Text, ActivityIndicator, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { makeStyles, useTheme, radius } from "@/src/theme";
import { haptic } from "@/src/utils/haptics";

export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  testID,
  style,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "gold";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const gradientColors =
    variant === "gold"
      ? [colors.brandSecondary, colors.goldDeep]
      : [colors.brand, colors.brandDeep];

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        haptic.medium();
        onPress();
      }}
      style={[styles.wrap, isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={gradientColors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.onBrandPrimary} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
}));
