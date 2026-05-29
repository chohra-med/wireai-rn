import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInput as TextInputType } from "react-native";
import { colors, radii, spacing, textStyles } from "../styles/tokens";

type InputFieldProps = {
  value?: string;
  defaultValue?: string;
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

const _InputField = React.forwardRef<TextInputType, InputFieldProps>(({
  value,
  defaultValue,
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
}, ref) => (
  <View>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      ref={ref}
      style={[styles.input, !editable && styles.inputDisabled]}
      value={value}
      defaultValue={defaultValue}
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
));

_InputField.displayName = "InputField";
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
