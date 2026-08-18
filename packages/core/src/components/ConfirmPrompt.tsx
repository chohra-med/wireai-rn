import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

const schema = z.object({
  question: z.string().describe("The yes/no question to ask the user"),
  confirmLabel: z.string().optional().describe("Confirm button label, default: Yes"),
  cancelLabel: z.string().optional().describe("Cancel button label, default: No"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onConfirm?: () => void;
    onCancel?: () => void;
  };

const _ConfirmPrompt: React.FC<Props> = ({
  question,
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  isStreaming = false,
}) => {
  const [submitted, setSubmitted] = useState(false);

  const handleConfirm = useCallback(() => {
    if (!submitted && !isStreaming) { setSubmitted(true); onConfirm?.(); }
  }, [submitted, isStreaming, onConfirm]);

  const handleCancel = useCallback(() => {
    if (!submitted && !isStreaming) { setSubmitted(true); onCancel?.(); }
  }, [submitted, isStreaming, onCancel]);

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Btn title={confirmLabel} onPress={handleConfirm} variant="primary" disabled={submitted || isStreaming} />
        </View>
        <View style={styles.flex1}>
          <Btn title={cancelLabel} onPress={handleCancel} variant="outline" disabled={submitted || isStreaming} />
        </View>
      </View>
    </View>
  );
};

export const ConfirmPrompt = {
  name: "ConfirmPrompt",
  description: "Use only for binary yes/no decisions before an important or irreversible action (e.g. booking, deletion, sending). Not for choosing between options — use SelectionCard for 3+ choices.",
  component: React.memo(_ConfirmPrompt),
  propsSchema: schema,
  defaultProps: { confirmLabel: "Yes", cancelLabel: "No" },
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  question: { ...textStyles.body, color: colors.text },
  row: { flexDirection: "row", gap: spacing.sm },
  flex1: { flex: 1 },
});
