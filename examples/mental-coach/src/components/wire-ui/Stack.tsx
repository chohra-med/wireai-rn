import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";

// Local NodeRef shape — the example uses Zod v4 while the SDK declares its
// NodeRefSchema in Zod v3. They validate the same runtime shape; we just keep
// the schemas version-local to avoid TS generic cross-talk.
const NodeRef = z.object({
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Stack — a vertical container that holds nested WireAI components.
 *
 * This is the *minimum-viable container* for exercising composition:
 * the LLM can now emit `{ component: "Stack", props: { children: [...] } }`
 * and the WireAI renderer pre-renders each child into a ReactNode before
 * handing the array down.
 */

const schema = z.object({
  title: z.string().optional().describe("Optional heading rendered above the children"),
  children: z
    .array(NodeRef)
    .describe(
      "Ordered list of nested WireAI components. Each entry must be a JSON object with its own 'component' and 'props' fields. Use to combine, e.g. a MessageBubble plus a ConfirmPrompt."
    ),
});

type Props = z.infer<typeof schema> & InjectedProps;

const _Stack: React.FC<Props> = ({ title, children }) => {
  // The SDK pre-renders the NodeRef[] in `children` into ReactNode[] before
  // this component mounts, so we can drop them straight into the view.
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.body}>{children as unknown as React.ReactNode}</View>
    </View>
  );
};

export const Stack = {
  name: "Stack",
  description:
    "Use when you want to combine multiple components in a single assistant turn — e.g. a MessageBubble followed by a ConfirmPrompt, or a StatusCard above an ActionCard. Wrap children inside a 'children' array of node references. Do NOT use Stack as a wrapper for a single component — emit that component directly instead.",
  component: React.memo(_Stack),
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
  title: { ...textStyles.body, fontWeight: "700" as const, color: colors.text },
  body: { gap: spacing.sm },
});
