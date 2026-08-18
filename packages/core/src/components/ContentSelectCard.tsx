import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, iconSizes, radii, spacing, textStyles } from "../styles/tokens";
import { Btn } from "../ui/Btn";
import type { InjectedProps } from "../types";

const itemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).slice(2)).describe("Unique key for this item"),
  title: z.string().describe("Item title shown prominently"),
  description: z.string().optional().describe("Supporting description shown below the title"),
});

const schema = z.object({
  title: z.string().describe("Section heading, e.g. 'Mediterranean Dishes'"),
  items: z.array(itemSchema).min(1).describe("Array of items. Each item: { id: string (required, unique key), title: string (required), description: string (optional) }"),
  multiSelect: z.boolean().optional().describe("Allow selecting multiple items at once, default false"),
  submitLabel: z.string().optional().describe("Submit button label, default: Continue"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSelect?: (selected: string | string[]) => void;
  };

type ItemRowProps = {
  item: z.infer<typeof itemSchema>;
  isSelected: boolean;
  multiSelect: boolean;
  onToggle: (id: string) => void;
  disabled: boolean;
};

const _ItemRow: React.FC<ItemRowProps> = ({ item, isSelected, multiSelect, onToggle, disabled }) => {
  const handlePress = useCallback(() => onToggle(item.id), [item.id, onToggle]);
  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <View
        style={[
          styles.item,
          isSelected ? styles.itemSelected : styles.itemUnselected,
          disabled && styles.itemDisabled,
        ]}
      >
        <View style={styles.itemRow}>
          <View
            style={[
              styles.indicator,
              { borderRadius: multiSelect ? radii.sm : radii.full },
              isSelected ? styles.indicatorSelected : styles.indicatorUnselected,
            ]}
          />
          <Text
            style={[styles.itemTitle, isSelected ? styles.itemTitleSelected : styles.itemTitleDefault]}
            numberOfLines={0}
          >
            {item.title}
          </Text>
        </View>
        {item.description ? (
          <Text style={styles.itemDesc}>{item.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
};
const ItemRow = React.memo(_ItemRow);

const _ContentSelectCard: React.FC<Props> = ({
  title,
  items,
  multiSelect = false,
  submitLabel = "Continue",
  onSelect,
  isStreaming = false,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = useCallback((id: string) => {
    if (submitted || isStreaming) return;
    if (multiSelect) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelected([id]);
    }
  }, [submitted, isStreaming, multiSelect]);

  const handleSubmit = useCallback(() => {
    if (!selected.length || !onSelect || submitted || isStreaming) return;
    setSubmitted(true);
    const selectedTitles = items
      .filter((item) => selected.includes(item.id))
      .map((item) => item.title);
    onSelect(multiSelect ? selectedTitles : selectedTitles[0]!);
  }, [selected, onSelect, submitted, isStreaming, items, multiSelect]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.itemsGap}>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selected.includes(item.id)}
            multiSelect={multiSelect}
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

export const ContentSelectCard = {
  name: "ContentSelectCard",
  description:
    "Use when items have a title AND a description and the user must choose one. Classic use cases: dish selection, recipe picking, topic browsing, recommendation choosing. Use InfoList instead when items are read-only summaries with no selection needed.",
  component: React.memo(_ContentSelectCard),
  propsSchema: schema,
  defaultProps: { multiSelect: false, submitLabel: "Continue" },
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
  cardTitle: { ...textStyles.h4, color: colors.text },
  itemsGap: { gap: spacing.xs },
  item: { padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1.5, gap: spacing.xs },
  itemSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  itemUnselected: { borderColor: colors.border, backgroundColor: colors.background },
  itemDisabled: { opacity: 0.5 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  indicator: { width: IND, height: IND, borderWidth: 2 },
  indicatorSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  indicatorUnselected: { borderColor: colors.border, backgroundColor: colors.background },
  itemTitle: { ...textStyles.body, fontWeight: "700" as const, flex: 1 },
  itemTitleSelected: { color: colors.primary },
  itemTitleDefault: { color: colors.text },
  itemDesc: { ...textStyles.caption, color: colors.textSecondary },
});
