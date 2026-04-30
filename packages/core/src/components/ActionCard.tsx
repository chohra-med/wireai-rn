import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

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
    onPress?: (label: string) => void;
    onSubmit?: (value: string) => void;
  };

const _ActionCard: React.FC<Props> = ({
  title,
  body,
  primaryLabel,
  primaryAction,
  secondaryLabel,
  secondaryAction,
  tertiaryLabel,
  tertiaryAction,
  onPrimaryPress,
  onSecondaryPress,
  onTertiaryPress,
  onPress,
  onSubmit,
}) => {
  const [submitted, setSubmitted] = useState(false);

  const handlePrimary = useCallback(() => {
    console.log("[WireAI] ActionCard: handlePrimary", { primaryAction, primaryLabel, hasOnPrimaryPress: !!onPrimaryPress, hasOnPress: !!onPress, hasOnSubmit: !!onSubmit });
    if (!submitted) {
      setSubmitted(true);
      if (onPrimaryPress) onPrimaryPress();
      else if (onPress) onPress(primaryLabel);
      else if (onSubmit) onSubmit(primaryAction);
    }
  }, [submitted, onPrimaryPress, onPress, onSubmit, primaryLabel, primaryAction]);

  const handleSecondary = useCallback(() => {
    if (!submitted) {
      setSubmitted(true);
      if (onSecondaryPress) onSecondaryPress();
      else if (onPress && secondaryLabel) onPress(secondaryLabel);
      else if (onSubmit && secondaryAction) onSubmit(secondaryAction);
    }
  }, [submitted, onSecondaryPress, onPress, onSubmit, secondaryLabel, secondaryAction]);

  const handleTertiary = useCallback(() => {
    if (!submitted) {
      setSubmitted(true);
      if (onTertiaryPress) onTertiaryPress();
      else if (onPress && tertiaryLabel) onPress(tertiaryLabel);
      else if (onSubmit && tertiaryAction) onSubmit(tertiaryAction);
    }
  }, [submitted, onTertiaryPress, onPress, onSubmit, tertiaryLabel, tertiaryAction]);

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
