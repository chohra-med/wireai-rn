import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, iconSizes, radii, spacing, textStyles, widths } from "../styles/tokens";
import { Btn } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

const schema = z.object({
  label: z.string().describe("What is being counted, e.g. 'Number of days' or 'Travellers'"),
  min: z.number().optional().describe("Minimum value, default 1"),
  max: z.number().optional().describe("Maximum value, default 30"),
  defaultValue: z.number().optional().describe("Starting value"),
  step: z.number().optional().describe("Increment per tap, default 1"),
  unit: z.string().optional().describe("Unit label shown next to value, e.g. 'days' or 'people'"),
  submitLabel: z.string().optional().describe("Confirm button label, default: Confirm"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSubmit?: (value: number) => void;
  };

const _NumberStepperCard: React.FC<Props> = ({
  label,
  min = 1,
  max = 30,
  defaultValue = 1,
  step = 1,
  unit,
  submitLabel = "Confirm",
  onSubmit,
}) => {
  const [value, setValue] = useState(Math.min(Math.max(defaultValue, min), max));
  const [submitted, setSubmitted] = useState(false);

  const handleDecrement = useCallback(() => {
    if (!submitted) setValue((v) => Math.max(v - step, min));
  }, [submitted, step, min]);

  const handleIncrement = useCallback(() => {
    if (!submitted) setValue((v) => Math.min(v + step, max));
  }, [submitted, step, max]);

  const handleSubmit = useCallback(() => {
    if (!submitted) { setSubmitted(true); onSubmit?.(value); }
  }, [submitted, onSubmit, value]);

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={atMin || submitted ? undefined : handleDecrement}
          disabled={atMin || submitted}
          style={[styles.stepBtn, atMin && styles.stepBtnDisabled]}
        >
          <Text style={[styles.stepBtnLabel, atMin && styles.stepBtnLabelDisabled]}>{"−"}</Text>
        </Pressable>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{String(value)}</Text>
          {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
        </View>
        <Pressable
          onPress={atMax || submitted ? undefined : handleIncrement}
          disabled={atMax || submitted}
          style={[styles.stepBtn, atMax && styles.stepBtnDisabled]}
        >
          <Text style={[styles.stepBtnLabel, atMax && styles.stepBtnLabelDisabled]}>{"+"}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.rangeHint}>{`${min} – ${max}${unit ? ` ${unit}` : ""}`}</Text>
      <Btn title={submitLabel} onPress={handleSubmit} variant="primary" disabled={submitted} />
    </View>
  );
};

export const NumberStepperCard = {
  name: "NumberStepperCard",
  description:
    "Use for any bounded numeric input: days, people, portions, budget tiers, ratings. Best for ranges 1–99. Set unit (e.g. 'days', 'people') for clarity. Use TextInputCard for open-ended numbers or ranges the user should type freely.",
  component: React.memo(_NumberStepperCard),
  propsSchema: schema,
  defaultProps: { min: 1, max: 30, defaultValue: 1, step: 1, submitLabel: "Confirm" },
};

const BTN_SIZE = iconSizes[22];
const VAL_WIDTH = widths[6];

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  label: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  stepBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  stepBtnDisabled: { borderColor: colors.border },
  stepBtnLabel: { ...textStyles.h3, color: colors.primary },
  stepBtnLabelDisabled: { color: colors.textSecondary },
  valueBox: { alignItems: "center", minWidth: VAL_WIDTH },
  valueText: { ...textStyles.h2, color: colors.primary, fontWeight: "700" as const },
  unitText: { ...textStyles.caption, color: colors.textSecondary },
  rangeHint: { ...textStyles.caption, color: colors.textTertiary, textAlign: "center" as const },
});
