import React, { useCallback, useMemo, useRef, memo } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ComponentRenderer,
  LoadingState,
  colors,
  spacing,
  textStyles,
  useWireAIAction,
  useWireAIStream,
  useWireAIThread,
} from "wireai-rn";
import type { CallbackOverrides, Message } from "wireai-rn";

/**
 * Demo screen for the two new SDK capabilities:
 *
 *  - **Composition** — the prompt below tells the model to wrap two children
 *    (`MessageBubble` + `ConfirmPrompt`) inside a `Stack` container. The
 *    renderer recurses into the tree and pre-renders each child for the
 *    container.
 *
 *  - **Streaming** — when the active adapter implements `chatStream`
 *    (OpenAI, Webhook), the bubble below subscribes via `useWireAIStream`
 *    and re-renders progressively as tokens arrive. With non-streaming
 *    adapters (Ollama, LM Studio) the same bubble simply renders the final
 *    `message.response`.
 *
 * The screen assumes `Stack` is registered in the `WireAIProvider`'s
 * components array (see `navigation/AppNavigator.tsx`).
 */

const COMPOSED_PROMPT =
  "For this turn, respond with a Stack component whose `children` is exactly " +
  "two nested components: first a MessageBubble with a short empathic message, " +
  "then a ConfirmPrompt asking whether I want to continue the check-in. " +
  "Do not use a single top-level MessageBubble — use Stack with nested children.";

// ─── Streaming-aware assistant bubble ────────────────────────────────────────

type AssistantBubbleProps = {
  message: Message;
  callbackOverrides: CallbackOverrides;
};

const _AssistantBubble: React.FC<AssistantBubbleProps> = ({ message, callbackOverrides }) => {
  // While streaming, this returns the latest partial response; once the
  // thread hook finalizes the message, `stream` clears and we fall back to
  // `message.response`.
  const stream = useWireAIStream(message.id);
  const response = stream?.response ?? message.response;
  const isStreaming = stream?.isStreaming ?? message.isStreaming ?? false;

  if (!response) {
    return (
      <Text style={styles.streamingHint}>
        {isStreaming ? "Streaming…" : "(empty)"}
      </Text>
    );
  }

  return (
    <ComponentRenderer
      messageId={message.id}
      response={response}
      callbackOverrides={callbackOverrides}
      isStreaming={isStreaming}
    />
  );
};

const AssistantBubble = React.memo(_AssistantBubble);

// ─── Per-row wrapper — stabilises callbackOverrides so AssistantBubble memo
// is not broken by a new object being created inside renderItem. ──────────────

type AssistantItemProps = {
  message: Message;
  createActions: (id: string) => CallbackOverrides;
};

const _AssistantItem: React.FC<AssistantItemProps> = ({ message, createActions }) => {
  const callbackOverrides = useMemo(
    () => createActions(message.id),
    [createActions, message.id]
  );
  return <AssistantBubble message={message} callbackOverrides={callbackOverrides} />;
};
const AssistantItem = memo(_AssistantItem);

// ─── Screen ──────────────────────────────────────────────────────────────────

type Props = { onSettings?: () => void };

const _ComposedDemoScreen: React.FC<Props> = ({ onSettings }) => {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const createActions = useWireAIAction(sendMessage);
  const listRef = useRef<FlatList>(null);

  const handleContentSizeChange = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const handleTrigger = useCallback(() => {
    sendMessage(COMPOSED_PROMPT, { interruptLoading: true });
  }, [sendMessage]);

  const keyExtractor = useCallback((m: Message) => m.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      if (item.role === "user") {
        return <Text style={styles.userBubble}>{item.content}</Text>;
      }
      if (item.role === "assistant") {
        return <AssistantItem message={item} createActions={createActions} />;
      }
      return null;
    },
    [createActions]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable onPress={onSettings} style={styles.header} hitSlop={12}>
          <Text style={styles.headerTitle}>Composed Demo</Text>
          <Text style={styles.gear}>⚙</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={handleContentSizeChange}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Tap the button below to ask the agent for a Stack containing a
              MessageBubble + ConfirmPrompt. If your adapter supports
              streaming, you'll see the tree fill in progressively.
            </Text>
          }
        />

        {isLoading ? <LoadingState /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.cta, isLoading && styles.ctaStop]}
          onPress={isLoading ? abort : handleTrigger}
        >
          <Text style={styles.ctaText}>
            {isLoading ? "Stop" : "Trigger composed + streamed reply"}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const ComposedDemoScreen = React.memo(_ComposedDemoScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...textStyles.h4, color: colors.text },
  gear: { fontSize: 20, color: colors.textSecondary },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  userBubble: {
    ...textStyles.body,
    color: colors.text,
    alignSelf: "flex-end",
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: 12,
    maxWidth: "85%",
  },
  streamingHint: { ...textStyles.caption, color: colors.textSecondary },
  error: {
    ...textStyles.caption,
    color: colors.error,
    padding: spacing.sm,
  },
  cta: {
    margin: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  ctaStop: { backgroundColor: colors.error },
  ctaText: { color: "#fff", ...textStyles.body, fontWeight: "700" as const },
});
