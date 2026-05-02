import React from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, radii, spacing, textStyles } from "wireai-rn";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
};

const _Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}) => (
  <TouchableOpacity
    style={[
      styles.base,
      variantBtnStyles[variant],
      disabled ? disabledBtnStyles[variant] : null,
      style,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
  >
    <Text
      style={[
        styles.text,
        variantTextStyles[variant],
        disabled ? styles.textDisabled : null,
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

export const Button = React.memo(_Button);

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { ...textStyles.body, fontWeight: "600" as const },
  textDisabled: { color: colors.textTertiary },
});

const variantBtnStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
  ghost: { backgroundColor: "transparent" },
});

const disabledBtnStyles = StyleSheet.create({
  primary: { backgroundColor: colors.disabled },
  outline: { borderColor: colors.disabled },
  ghost: {},
});

const variantTextStyles = StyleSheet.create({
  primary: { color: colors.textInverse },
  outline: { color: colors.primary },
  ghost: { color: colors.primary },
});
