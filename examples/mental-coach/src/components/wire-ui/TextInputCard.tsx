import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "wireai-rn";
import { Btn } from "wireai-rn";
import { InputField } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

const schema = z.object({
  label: z.string().describe("Input field label"),
  placeholder: z.string().optional().describe("Placeholder text"),
  submitLabel: z.string().optional().describe("Submit button label, default: Submit"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSubmit?: (value: string) => void;
  };

const _TextInputCard: React.FC<Props> = ({
  label,
  placeholder,
  submitLabel = "Submit",
  onSubmit,
}) => {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    if (value.trim() && onSubmit && !submitted) {
      setSubmitted(true);
      onSubmit(value.trim());
    }
  }, [value, onSubmit, submitted]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <InputField
        value={value}
        onChangeText={setValue}
        placeholder={placeholder ?? ""}
        editable={!submitted}
      />
      <Btn
        title={submitLabel}
        onPress={handleSubmit}
        variant="primary"
        disabled={!value.trim() || submitted}
      />
    </View>
  );
};

export const TextInputCard = {
  name: "TextInputCard",
  description: "Use when the user needs to type a free-text answer: name, destination, notes, search query, open-ended goal. Use NumberStepperCard for numeric ranges with known bounds.",
  component: React.memo(_TextInputCard),
  propsSchema: schema,
  defaultProps: { submitLabel: "Submit" },
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  label: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
});
