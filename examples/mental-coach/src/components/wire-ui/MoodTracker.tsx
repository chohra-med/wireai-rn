import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, iconSizes, radii, spacing, textStyles } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

const MOODS = [
  { score: 1, emoji: "😔", label: "Very low" },
  { score: 2, emoji: "😕", label: "Low" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😊", label: "Great" },
] as const;

type MoodEntry = (typeof MOODS)[number];

const schema = z.object({
  question: z.string().describe("The mood check-in question to display to the user"),
  instruction: z
    .string()
    .optional()
    .describe("Short instruction below the question, e.g. 'Tap how you feel right now'"),
});

type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSelect?: (value: unknown) => void;
  };

type MoodButtonProps = {
  mood: MoodEntry;
  selected: boolean;
  disabled: boolean;
  onPress: (mood: MoodEntry) => void;
};

const _MoodButton: React.FC<MoodButtonProps> = ({ mood, selected, disabled, onPress }) => {
  const handlePress = useCallback(() => onPress(mood), [mood, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={iconSizes[22]}
      accessibilityRole="button"
      accessibilityLabel={`${mood.label}, score ${mood.score} of 5`}
      accessibilityState={{ selected, disabled }}
      style={[styles.moodBtn, selected && styles.moodBtnSelected]}
    >
      <Text style={styles.emoji}>{mood.emoji}</Text>
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>
        {mood.label}
      </Text>
    </Pressable>
  );
};
const MoodButton = React.memo(_MoodButton);

const _MoodTracker: React.FC<Props> = ({ question, instruction, onSelect }) => {
  const [selected, setSelected] = useState<MoodEntry | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Ref keeps handlePress stable across the submitted state change so
  // MoodButton instances don't re-render after selection.
  const submittedRef = useRef(false);

  const handlePress = useCallback(
    (mood: MoodEntry) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSelected(mood);
      setSubmitted(true);
      onSelect?.({ score: mood.score, emoji: mood.emoji, label: mood.label });
    },
    [onSelect]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question}</Text>
      {instruction ? <Text style={styles.instruction}>{instruction}</Text> : null}
      <View style={styles.row}>
        {MOODS.map((mood) => (
          <MoodButton
            key={mood.score}
            mood={mood}
            selected={selected?.score === mood.score}
            disabled={submitted}
            onPress={handlePress}
          />
        ))}
      </View>
      {submitted && selected ? (
        <Text style={styles.confirmation}>
          {selected.emoji} {selected.label} — got it
        </Text>
      ) : null}
    </View>
  );
};

export const MoodTracker = {
  name: "MoodTracker",
  description:
    "Use when capturing the user's emotional state or mood on a 1–5 scale. Renders 5 emoji mood buttons (😔 😕 😐 🙂 😊). Use instead of SelectionCard when the input is specifically about feelings or mood. Never use for preference selection, topic choices, or non-emotional inputs.",
  component: React.memo(_MoodTracker),
  propsSchema: schema,
  defaultProps: { instruction: "Tap how you feel right now" },
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
  question: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  instruction: { ...textStyles.caption, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    minHeight: iconSizes[22],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  moodBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  emoji: { fontSize: 24 },
  label: { ...textStyles.caption, marginTop: 4 },
  labelDefault: { color: colors.textSecondary },
  labelSelected: { color: colors.primary, fontWeight: "600" as const },
  confirmation: {
    ...textStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
