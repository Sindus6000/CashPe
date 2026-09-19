import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from "react-native-reanimated";

const COLORS = ["#10B981", "#F59E0B", "#22C55E", "#FDE68A", "#D97706", "#047857"];

function Piece({ index, width }: { index: number; width: number }) {
  const startX = (Math.random() * width) | 0;
  const size = 7 + Math.floor(Math.random() * 8);
  const color = COLORS[index % COLORS.length];
  const drift = (Math.random() - 0.5) * 80;
  const duration = 1800 + Math.floor(Math.random() * 1400);
  const delay = Math.floor(Math.random() * 500);

  const progress = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }));
    spin.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, false);
  }, [delay, duration, progress, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * 720 },
      { translateX: progress.value * drift },
      { rotate: `${spin.value * 360}deg` },
    ],
    opacity: 1 - progress.value * 0.4,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: -20,
          left: startX,
          width: size,
          height: size * 1.4,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ count = 40 }: { count?: number }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} width={width} />
      ))}
    </View>
  );
}
