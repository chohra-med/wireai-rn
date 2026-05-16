import React from "react";
import type { TextInput, TextInputProps } from "react-native";
import { StyleSheet, Text, TextInput as RNTextInput, View } from "react-native";
import { colors, radii, spacing, textStyles } from "wireai-rn";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

const _Input = React.forwardRef<TextInput, InputProps>(({ label, error, style, ...props }, ref) => (
  <View style={styles.container}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <RNTextInput
      ref={ref}
      style={[styles.input, error ? styles.inputError : null, style]}
      placeholderTextColor={colors.textTertiary}
      {...props}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
));

_Input.displayName = "Input";
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
