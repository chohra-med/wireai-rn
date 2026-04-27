import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, textStyles } from "../styles/tokens";

type BtnVariant = "primary" | "outline" | "ghost";

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
};

const _Btn: React.FC<BtnProps> = ({ title, onPress, variant = "primary", disabled = false }) => (
  <Pressable
    style={[
      styles.base,
      variant === "primary" && styles.primary,
      variant === "outline" && styles.outline,
      disabled && styles.disabled,
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text
      style={[
        styles.label,
        variant === "primary" && styles.labelPrimary,
        variant === "outline" && styles.labelOutline,
        variant === "ghost" && styles.labelGhost,
        disabled && styles.labelDisabled,
      ]}
    >
      {title}
    </Text>
  </Pressable>
);

export const Btn = React.memo(_Btn);

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1.5, borderColor: colors.primary },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  label: { ...textStyles.body, fontWeight: "600" as const },
  labelPrimary: { color: colors.textInverse },
  labelOutline: { color: colors.primary },
  labelGhost: { color: colors.primary },
  labelDisabled: { color: colors.textSecondary },
});
