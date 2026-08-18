import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, iconSizes, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

const optionObjectSchema = z.object({
  value: z.string().describe("Option value"),
  label: z.string().describe("Option display label"),
});

const schema = z.object({
  title: z.string().describe("Question or prompt for the user"),
  options: z.preprocess(
    (arr) =>
      Array.isArray(arr)
        ? arr.map((item) => (typeof item === "string" ? { value: item, label: item } : item))
        : arr,
    z.array(optionObjectSchema).min(1)
  ).describe("List of choices"),
  submitLabel: z.string().optional().describe("Submit button label, default: Continue"),
  multiSelect: z.boolean().optional().describe("Allow multiple selections"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSelect?: (selected: string | string[]) => void;
  };

type OptionRowProps = {
  opt: z.infer<typeof optionObjectSchema>;
  isSelected: boolean;
  onToggle: (value: string) => void;
  disabled: boolean;
};

const _OptionRow: React.FC<OptionRowProps> = ({ opt, isSelected, onToggle, disabled }) => {
  const handlePress = useCallback(() => onToggle(opt.value), [opt.value, onToggle]);
  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <View
        style={[
          styles.option,
          isSelected ? styles.optionSelected : styles.optionUnselected,
          disabled && styles.optionDisabled,
        ]}
      >
        <View style={[styles.indicator, isSelected ? styles.indicatorSelected : styles.indicatorUnselected]} />
        <Text style={[styles.optionLabel, isSelected ? styles.optionLabelSelected : styles.optionLabelDefault]}>
          {opt.label}
        </Text>
      </View>
    </Pressable>
  );
};
const OptionRow = React.memo(_OptionRow);

const _SelectionCard: React.FC<Props> = ({
  title,
  options,
  submitLabel = "Continue",
  multiSelect = false,
  onSelect,
  isStreaming = false,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = useCallback((value: string) => {
    if (submitted || isStreaming) return;
    if (multiSelect) {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      setSelected([value]);
    }
  }, [submitted, isStreaming, multiSelect]);

  const handleSubmit = useCallback(() => {
    if (!selected.length || !onSelect || submitted || isStreaming) return;
    setSubmitted(true);
    onSelect(multiSelect ? selected : selected[0]!);
  }, [selected, onSelect, submitted, isStreaming, multiSelect]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.optionsGap}>
        {options.map((opt) => (
          <OptionRow
            key={opt.value}
            opt={opt}
            isSelected={selected.includes(opt.value)}
            onToggle={toggle}
            disabled={isStreaming}
          />
        ))}
      </View>
      <Btn
        title={submitLabel}
        onPress={handleSubmit}
        variant="primary"
        disabled={selected.length === 0 || submitted || isStreaming}
      />
    </View>
  );
};

export const SelectionCard = {
  name: "SelectionCard",
  description: "Use for mutually exclusive (radio) or multi-select (checkbox) choices from 2–8 options. Use ChipSelectCard instead when options are short single words. Use ContentSelectCard when options need a title + description.",
  component: React.memo(_SelectionCard),
  propsSchema: schema,
  defaultProps: { submitLabel: "Continue", multiSelect: false },
};

const IND = iconSizes[6];

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  optionsGap: { gap: spacing.xs },
  option: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  optionUnselected: { borderColor: colors.border, backgroundColor: colors.background },
  optionDisabled: { opacity: 0.5 },
  indicator: { width: IND, height: IND, borderRadius: radii.full, borderWidth: 2 },
  indicatorSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  indicatorUnselected: { borderColor: colors.border, backgroundColor: colors.background },
  optionLabel: { ...textStyles.body },
  optionLabelSelected: { color: colors.primary },
  optionLabelDefault: { color: colors.text },
});
