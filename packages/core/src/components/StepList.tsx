import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, iconSizes, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

const stepObjectSchema = z.object({
  title: z.string().describe("Step title"),
  description: z.string().optional().describe("Optional step detail"),
  done: z.boolean().optional().describe("Whether this step is completed"),
});

const schema = z.object({
  title: z.string().optional().describe("List heading"),
  steps: z.preprocess(
    (arr) =>
      Array.isArray(arr)
        ? arr.map((item) => (typeof item === "string" ? { title: item } : item))
        : arr,
    z.array(stepObjectSchema)
  ).describe("Ordered steps"),
  ctaLabel: z.string().optional().describe("Call-to-action button label shown below the list. Always include this so the user can continue, e.g. 'What else can I help with?'"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onContinue?: () => void;
    onPress?: (label: string) => void;
    onSubmit?: (value: string) => void;
  };

const _StepList: React.FC<Props> = ({ title, steps, ctaLabel, onContinue, onPress, onSubmit, isStreaming = false }) => {
  const [submitted, setSubmitted] = useState(false);

  const handleContinue = useCallback(() => {
    if (!submitted && !isStreaming) {
      setSubmitted(true);
      if (onContinue) onContinue();
      else if (onPress && ctaLabel) onPress(ctaLabel);
      else if (onSubmit) onSubmit("continue");
    }
  }, [submitted, isStreaming, onContinue, onPress, onSubmit, ctaLabel]);

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.heading}>{title}</Text> : null}
      {steps.map((step, i) => (
        <View key={`${i}-${step.title}`} style={[styles.stepRow, step.done && styles.stepDone]}>
          <View style={[styles.circle, step.done ? styles.circleDone : styles.circleActive]}>
            <Text style={styles.circleLabel}>
              {step.done ? "✓" : String(i + 1)}
            </Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            {step.description ? (
              <Text style={styles.stepDesc}>{step.description}</Text>
            ) : null}
          </View>
        </View>
      ))}
      {ctaLabel ? (
        <Btn title={ctaLabel} onPress={handleContinue} variant="primary" disabled={submitted || isStreaming} />
      ) : null}
    </View>
  );
};

export const StepList = {
  name: "StepList",
  description: "Use for ordered sequences: itineraries, how-to guides, plans, timelines, recipes. Steps can be marked done. Always include ctaLabel (e.g. 'Explore more tips', 'Continue →') so the user can act after reading.",
  component: React.memo(_StepList),
  propsSchema: schema,
};

const CIRCLE = iconSizes[10];

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  heading: { ...textStyles.h4, color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  stepDone: { opacity: 0.5 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  circleDone: { backgroundColor: colors.success },
  circleActive: { backgroundColor: colors.primary },
  circleLabel: { ...textStyles.caption, color: colors.textInverse, fontWeight: "700" as const },
  stepContent: { flex: 1, gap: spacing.xs },
  stepTitle: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  stepDesc: { ...textStyles.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
