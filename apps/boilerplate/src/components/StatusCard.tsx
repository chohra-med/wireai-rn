import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "wireai-rn";
import { Btn } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

const STATUS_COLORS = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
} as const;

const schema = z.object({
  status: z.enum(["success", "warning", "error", "info"]).describe("Status type"),
  title: z.string().describe("Status title"),
  message: z.string().optional().describe("Supporting message"),
  ctaLabel: z.string().optional().describe("Optional call-to-action button label, e.g. 'What would you like to do next?'. Always include this on success status to keep the conversation going."),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onContinue?: () => void;
  };

const STATUS_ICONS: Record<string, string> = {
  success: "✓",
  warning: "⚠",
  error: "✗",
  info: "ℹ",
};

const _StatusCard: React.FC<Props> = ({ status, title, message, ctaLabel, onContinue }) => {
  const [submitted, setSubmitted] = useState(false);
  const color = STATUS_COLORS[status] ?? colors.info;

  const handleContinue = useCallback(() => {
    if (!submitted) { setSubmitted(true); onContinue?.(); }
  }, [submitted, onContinue]);

  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.icon, { color }]}>{STATUS_ICONS[status] ?? "·"}</Text>
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {ctaLabel ? (
        <Btn title={ctaLabel} onPress={handleContinue} variant="primary" disabled={submitted} />
      ) : null}
    </View>
  );
};

export const StatusCard = {
  name: "StatusCard",
  description: "Use ONLY for real outcomes: booking confirmed, data saved, action completed. NEVER for 'you just viewed X' acknowledgments. Always include ctaLabel so the user can continue after seeing the status.",
  component: React.memo(_StatusCard),
  propsSchema: schema,
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { ...textStyles.h4 },
  title: { ...textStyles.h4 },
  message: { ...textStyles.body, color: colors.textSecondary },
});
