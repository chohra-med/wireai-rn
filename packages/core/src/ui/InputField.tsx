import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, textStyles } from "../styles/tokens";

type InputFieldProps = {
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  editable?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  returnKeyType?: "done" | "send" | "next" | "go";
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
};

const _InputField: React.FC<InputFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  multiline = false,
  editable = true,
  secureTextEntry = false,
  autoCapitalize = "sentences",
  autoCorrect = true,
  returnKeyType,
  blurOnSubmit = true,
  onSubmitEditing,
}) => (
  <View>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      style={[styles.input, !editable && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      editable={editable}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      returnKeyType={returnKeyType}
      blurOnSubmit={blurOnSubmit}
      onSubmitEditing={onSubmitEditing}
    />
  </View>
);

export const InputField = React.memo(_InputField);

const styles = StyleSheet.create({
  label: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...textStyles.body,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  inputDisabled: {
    backgroundColor: colors.backgroundSecondary,
  },
});
