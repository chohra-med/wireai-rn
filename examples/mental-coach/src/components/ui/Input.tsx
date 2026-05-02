import React from "react";
import type { TextInputProps } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, textStyles } from "wireai-rn";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

const _Input: React.FC<InputProps> = ({ label, error, style, ...props }) => (
  <View style={styles.container}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      style={[styles.input, error ? styles.inputError : null, style]}
      placeholderTextColor={colors.textTertiary}
      {...props}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

export const Input = React.memo(_Input);

const styles = StyleSheet.create({
  container: { gap: spacing.xs, width: "100%" },
  label: { ...textStyles.caption, color: colors.textSecondary, fontWeight: "600" as const },
  input: {
    ...textStyles.body,
    padding: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  inputError: { borderColor: colors.error },
  errorText: { ...textStyles.caption, color: colors.error },
});
