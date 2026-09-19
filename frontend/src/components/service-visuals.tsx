import React from "react";
import { View, Text } from "react-native";
import {
  DeviceMobile,
  Television,
  Lightning,
  WifiHigh,
  IconProps,
} from "phosphor-react-native";

import { makeStyles } from "@/src/theme";
import type { ServiceType } from "@/src/constants/catalog";

const ICONS: Record<string, React.ComponentType<IconProps>> = {
  mobile: DeviceMobile,
  dth: Television,
  electricity: Lightning,
  broadband: WifiHigh,
};

export function ServiceIcon({
  type,
  size = 26,
  color,
  weight = "fill",
}: {
  type: ServiceType | string;
  size?: number;
  color: string;
  weight?: IconProps["weight"];
}) {
  const Cmp = ICONS[type] ?? DeviceMobile;
  return <Cmp size={size} color={color} weight={weight} />;
}

const useStyles = makeStyles((colors) => ({
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  border: {
    borderWidth: 1,
    borderColor: colors.border,
  },
}));

export function OperatorAvatar({
  short,
  color,
  size = 46,
}: {
  short: string;
  color: string;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: color, width: size, height: size, borderRadius: size * 0.3 },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.32 }]} numberOfLines={1}>
        {short}
      </Text>
    </View>
  );
}
