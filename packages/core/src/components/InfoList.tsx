import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

// .catch("") means validation never fails for individual item fields
const itemObjectSchema = z.object({
  label: z.string().catch("").describe("Item label"),
  value: z.string().catch("").describe("Item value"),
});

const normaliseItem = (item: unknown): Record<string, unknown> => {
  if (typeof item === "string") return { label: item, value: "" };
  if (item !== null && typeof item === "object") {
    const o = item as Record<string, unknown>;
    // Named aliases first
    const knownLabel = o.label ?? o.key ?? o.name ?? o.title ?? o.field;
    const knownValue = o.value ?? o.content ?? o.description ?? o.detail ?? o.text;
    if (knownLabel !== undefined || knownValue !== undefined) {
      return { label: String(knownLabel ?? ""), value: String(knownValue ?? "") };
    }
    // LLM may send {"Destination": "Tokyo"} — first key IS the label, its value IS the value
    const keys = Object.keys(o);
    if (keys.length > 0) {
      return { label: keys[0]!, value: String(o[keys[0]!] ?? "") };
    }
  }
  return { label: "", value: "" };
};

const schema = z.object({
  title: z.string().optional().describe("Section title"),
  items: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v.map(normaliseItem);
      // LLM may send items as a dict {"Destination":"Bali","Duration":"15 days"}
      if (v !== null && typeof v === "object") {
        return Object.entries(v as Record<string, unknown>).map(([label, value]) => ({
          label,
          value: Array.isArray(value) ? (value as unknown[]).join(", ") : String(value ?? ""),
        }));
      }
      return [];
    },
    z.array(itemObjectSchema)
  ).describe("List of label/value pairs"),
  continueLabel: z.string().optional().describe("If provided, shows a continue button — use when this summary precedes a confirm/next step"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onContinue?: () => void;
    onPress?: (label: string) => void;
    onSubmit?: (value: string) => void;
  };

const _InfoList: React.FC<Props> = ({ title, items, continueLabel, onContinue, onPress, onSubmit, isStreaming = false }) => {
  const [submitted, setSubmitted] = useState(false);

  const handleContinue = useCallback(() => {
    if (!submitted && !isStreaming) {
      setSubmitted(true);
      if (onContinue) onContinue();
      else if (onPress && continueLabel) onPress(continueLabel);
      else if (onSubmit) onSubmit("continue");
    }
  }, [submitted, isStreaming, onContinue, onPress, onSubmit, continueLabel]);

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {items.map((item) => {
        // Long values (descriptions) render in a column; short values (data) stay inline
        const isLong = item.value.length > 50;
        return isLong ? (
          <View key={item.label} style={styles.longItem}>
            <Text style={styles.longLabel}>{item.label}</Text>
            <Text style={styles.longValue}>{item.value}</Text>
          </View>
        ) : (
          <View key={item.label} style={styles.inlineItem}>
            <Text style={styles.inlineLabel}>{item.label}</Text>
            <Text style={styles.inlineValue}>{item.value}</Text>
          </View>
        );
      })}
      {continueLabel ? (
        <Btn title={continueLabel} onPress={handleContinue} variant="primary" disabled={submitted || isStreaming} />
      ) : null}
    </View>
  );
};

export const InfoList = {
  name: "InfoList",
  description: "Use for read-only key/value summaries: trip details, booking confirmations, collected data. NEVER use when the user should pick one of the items — use ContentSelectCard then. Always set continueLabel so the user can proceed.",
  component: React.memo(_InfoList),
  propsSchema: schema,
  defaultProps: { items: [] as { label: string; value: string }[] },
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
  title: { ...textStyles.h4, color: colors.text, marginBottom: spacing.xs },
  longItem: { gap: spacing.xs },
  longLabel: { ...textStyles.body, color: colors.textSecondary, fontWeight: "700" as const },
  longValue: { ...textStyles.body, color: colors.text },
  inlineItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inlineLabel: { ...textStyles.body, color: colors.textSecondary, flex: 1 },
  inlineValue: { ...textStyles.body, fontWeight: "700" as const, textAlign: "right" as const },
});
