import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "wireai-rn";
import { Btn } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

const schema = z.object({
  title: z.string().describe("Card heading"),
  body: z.string().optional().describe("Card description text"),
  primaryLabel: z.string().describe("Primary button label"),
  primaryAction: z.string().describe("Action key emitted when primary button is pressed"),
  secondaryLabel: z.string().optional().describe("Optional second button label"),
  secondaryAction: z.string().optional().describe("Action key for second button"),
  tertiaryLabel: z.string().optional().describe("Optional third button label"),
  tertiaryAction: z.string().optional().describe("Action key for third button"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onPrimaryPress?: () => void;
    onSecondaryPress?: () => void;
    onTertiaryPress?: () => void;
  };

const _ActionCard: React.FC<Props> = ({
  title,
  body,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  onTertiaryPress,
}) => {
  const [submitted, setSubmitted] = useState(false);

  const handlePrimary = useCallback(() => {
    if (!submitted) { setSubmitted(true); onPrimaryPress?.(); }
  }, [submitted, onPrimaryPress]);

  const handleSecondary = useCallback(() => {
    if (!submitted) { setSubmitted(true); onSecondaryPress?.(); }
  }, [submitted, onSecondaryPress]);

  const handleTertiary = useCallback(() => {
    if (!submitted) { setSubmitted(true); onTertiaryPress?.(); }
  }, [submitted, onTertiaryPress]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <Btn title={primaryLabel} onPress={handlePrimary} variant="primary" disabled={submitted} />
      {secondaryLabel ? (
        <Btn title={secondaryLabel} onPress={handleSecondary} variant="outline" disabled={submitted} />
      ) : null}
      {tertiaryLabel ? (
        <Btn title={tertiaryLabel} onPress={handleTertiary} variant="outline" disabled={submitted} />
      ) : null}
    </View>
  );
};

export const ActionCard = {
  name: "ActionCard",
  description: "Use after InfoList, StepList, or StatusCard to offer 1–3 next-step choices. Each button should describe what the user will get, not just name an action. Required when the user says 'Continue.' — never use StatusCard or ask a question instead.",
  component: React.memo(_ActionCard),
  propsSchema: schema,
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
  title: { ...textStyles.h4, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
});
