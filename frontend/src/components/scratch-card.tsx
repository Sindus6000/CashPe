import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { HandTap, Coins } from "phosphor-react-native";

import { makeStyles, useTheme, radius } from "@/src/theme";
import { haptic } from "@/src/utils/haptics";

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function ScratchCard({
  onReveal,
  size = 260,
  children,
}: {
  onReveal: () => void;
  size?: number;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const [revealed, setRevealed] = useState(false);

  const tick = () => {
    haptic.select();
  };
  const finish = () => {
    if (!revealed) {
      setRevealed(true);
      haptic.success();
      onReveal();
    }
  };

  const pan = Gesture.Pan()
    .minDistance(1)
    .onUpdate(() => {
      if (progress.value >= 1) return;
      progress.value = Math.min(1, progress.value + 0.05);
      if (Math.random() < 0.25) runOnJS(tick)();
      if (progress.value >= 0.5) {
        progress.value = withTiming(1, { duration: 350 });
        runOnJS(finish)();
      }
    });

  // Press-to-reveal fallback (reliable everywhere; drag still scratches on device)
  const reveal = () => {
    if (revealed) return;
    progress.value = withTiming(1, { duration: 400 });
    finish();
  };

  const coverStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={StyleSheet.absoluteFill}>{children}</View>
      <Pressable
        testID="scratch-cover"
        onPress={reveal}
        style={StyleSheet.absoluteFill}
        pointerEvents={revealed ? "none" : "auto"}
      >
        <GestureDetector gesture={pan}>
          <AnimatedGradient
            colors={[colors.brandSecondary, colors.goldDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cover, coverStyle]}
          >
            <Coins size={54} color={colors.onSurfaceInverse} weight="fill" />
            <Text style={styles.coverTitle}>Scratch Here</Text>
            <View style={styles.tapRow}>
              <HandTap size={16} color="#FFFFFF" weight="fill" />
              <Text style={styles.coverHint}>Tap or swipe to reveal</Text>
            </View>
          </AnimatedGradient>
        </GestureDetector>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.goldLight,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  coverTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coverHint: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.95,
  },
}));
