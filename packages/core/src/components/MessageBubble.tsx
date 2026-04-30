import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import type { InjectedProps } from "../types";

const schema = z.object({
  text: z.string().describe("The message content to display"),
  role: z.enum(["user", "assistant"]).optional().describe("Who sent this message"),
});

type Props = z.infer<typeof schema> & InjectedProps;

const _MessageBubble: React.FC<Props> = ({ text, role = "assistant" }) => {
  const isUser = role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
        {text}
      </Text>
    </View>
  );
};

export const MessageBubble = {
  name: "MessageBubble",
  description: "Use sparingly for a plain acknowledgment message. Prefer the 'message' field on render responses instead. Never use as a final turn — always follow with an interactive component (ActionCard, SelectionCard, etc.).",
  component: React.memo(_MessageBubble),
  propsSchema: schema,
  defaultProps: { role: "assistant" as const },
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    marginVertical: spacing.xs,
    maxWidth: "80%",
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.backgroundSecondary },
  text: { ...textStyles.body },
  userText: { color: colors.textInverse },
  assistantText: { color: colors.text },
});
