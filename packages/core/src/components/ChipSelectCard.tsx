import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

const schema = z.object({
  title: z.string().describe("Question or section header, e.g. 'Which season?'"),
  chips: z
    .array(z.string())
    .min(1)
    .describe("List of option labels shown as chips, e.g. ['Spring','Summer','Autumn','Winter']"),
  multiSelect: z.boolean().optional().describe("Allow multiple chips selected at once, default true"),
  submitLabel: z.string().optional().describe("Confirm button label, default: Continue"),
  maxSelections: z
    .number()
    .optional()
    .describe("Maximum number of chips the user can select at once"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSelect?: (selected: string | string[]) => void;
  };

const _ChipSelectCard: React.FC<Props> = ({
  title,
  chips,
  multiSelect = true,
  submitLabel = "Continue",
  maxSelections,
  onSelect,
  isStreaming = false,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = useCallback((chip: string) => {
    if (submitted || isStreaming) return;
    if (multiSelect) {
      setSelected((prev) => {
        if (prev.includes(chip)) return prev.filter((c) => c !== chip);
        if (maxSelections && prev.length >= maxSelections) return prev;
        return [...prev, chip];
      });
    } else {
      setSelected([chip]);
    }
  }, [submitted, isStreaming, multiSelect, maxSelections]);

  const handleSubmit = useCallback(() => {
    if (!selected.length || !onSelect || submitted || isStreaming) return;
    setSubmitted(true);
    onSelect(multiSelect ? selected : selected[0]!);
  }, [selected, onSelect, submitted, isStreaming, multiSelect]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {maxSelections ? (
        <Text style={styles.hint}>{`Select up to ${maxSelections}`}</Text>
      ) : null}
      <View style={styles.chipsRow}>
        {chips.map((chip) => (
          <ChipItem
            key={chip}
            chip={chip}
            isSelected={selected.includes(chip)}
            onToggle={toggle}
            disabled={isStreaming || submitted}
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

type ChipItemProps = {
  chip: string;
  isSelected: boolean;
  onToggle: (chip: string) => void;
  disabled: boolean;
};

const _ChipItem: React.FC<ChipItemProps> = ({ chip, isSelected, onToggle, disabled }) => {
  const handlePress = useCallback(() => onToggle(chip), [chip, onToggle]);
  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <View
        style={[
          styles.chip,
          isSelected ? styles.chipSelected : styles.chipUnselected,
          disabled && styles.chipDisabled,
        ]}
      >
        <Text style={[styles.chipLabel, isSelected ? styles.chipLabelSelected : styles.chipLabelDefault]}>
          {chip}
        </Text>
      </View>
    </Pressable>
  );
};
const ChipItem = React.memo(_ChipItem);

export const ChipSelectCard = {
  name: "ChipSelectCard",
  description:
    "Use for compact short labels: seasons, activities, travel styles, moods, categories. Ideal for 4–12 single-word or two-word options. Use SelectionCard instead when options need descriptions. Use ContentSelectCard when options need a title + explanation.",
  component: React.memo(_ChipSelectCard),
  propsSchema: schema,
  defaultProps: { multiSelect: true, submitLabel: "Continue" },
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
  title: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  hint: { ...textStyles.caption, color: colors.textSecondary },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  chipUnselected: { borderColor: colors.border, backgroundColor: colors.background },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { ...textStyles.caption },
  chipLabelSelected: { color: colors.primary, fontWeight: "700" as const },
  chipLabelDefault: { color: colors.textSecondary },
});
