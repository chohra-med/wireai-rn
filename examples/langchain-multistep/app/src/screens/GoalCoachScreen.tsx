import React, { useCallback, useMemo, useRef } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ComponentRenderer,
  LoadingState,
  colors,
  spacing,
  useWireAIAction,
  useWireAIInput,
  useWireAIThread,
} from "wireai-rn";
import type { CallbackOverrides, Message } from "wireai-rn";
import { Box } from "../components/ui/Box";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Typography } from "../components/ui/Typography";

// ─── Sub-components ──────────────────────────────────────────────────────────

type UserMessageProps = { content: string };

const _UserMessage: React.FC<UserMessageProps> = ({ content }) => (
  <Box alignSelf="flex-end" maxWidth="85%" marginVertical="xs" paddingHorizontal="md">
    <Box padding="sm" paddingHorizontal="md" backgroundColor={colors.primary} borderRadius={20}>
      <Typography color={colors.textInverse}>{content}</Typography>
    </Box>
  </Box>
);
const UserMessage = React.memo(_UserMessage);

type AssistantMessageProps = {
  item: Message;
  createActions: (id: string) => CallbackOverrides;
};

const _AssistantMessage: React.FC<AssistantMessageProps> = ({ item, createActions }) => {
  const callbackOverrides = useMemo(() => createActions(item.id), [createActions, item.id]);

  if (item.content && !item.response) {
    return (
      <Box
        padding="md"
        backgroundColor={colors.backgroundSecondary}
        borderRadius={20}
        alignSelf="flex-start"
        maxWidth="85%"
      >
        <Typography>{item.content}</Typography>
      </Box>
    );
  }

  if (item.response) {
    return (
      <ComponentRenderer
        messageId={item.id}
        response={item.response}
        callbackOverrides={callbackOverrides}
      />
    );
  }

  return null;
};
const AssistantMessage = React.memo(_AssistantMessage);

// ─── Screen ──────────────────────────────────────────────────────────────────

type GoalCoachScreenProps = { onSettings?: () => void };

const _GoalCoachScreen: React.FC<GoalCoachScreenProps> = ({ onSettings }) => {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const { inputRef, inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);
  const createActions = useWireAIAction(sendMessage);
  const listRef = useRef<FlatList>(null);

  const handleContentSizeChange = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const handleStart = useCallback(() => sendMessage("Let's start"), [sendMessage]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      if (item.role === "user") {
        return <UserMessage content={item.content} />;
      }
      if (item.role === "assistant") {
        return (
          <Box paddingHorizontal="md" marginVertical="sm">
            <AssistantMessage item={item} createActions={createActions} />
          </Box>
        );
      }
      return null;
    },
    [createActions]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Box
        paddingHorizontal="md"
        paddingVertical="sm"
        borderBottomWidth={1}
        borderColor={colors.border}
        flexDirection="row"
        alignItems="center"
        gap="sm"
      >
        <Box flex={1}>
          <Typography variant="h4">Goal Coach</Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            Powered by a LangChain multi-step workflow
          </Typography>
        </Box>
        {onSettings ? (
          <Pressable onPress={onSettings} hitSlop={12}>
            <Text style={styles.settingsIcon}>{"⚙"}</Text>
          </Pressable>
        ) : null}
      </Box>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Box flex={1} backgroundColor={colors.background}>
          {messages.length === 0 ? (
            <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
              <Typography variant="h3" textAlign="center">
                What are you working on?
              </Typography>
              <Typography variant="body" color={colors.textSecondary} textAlign="center">
                I'll ask 2 quick questions, then a LangChain workflow will retrieve your profile and
                build a 3-step plan.
              </Typography>
              <Button title="Start" onPress={handleStart} style={styles.startBtn} />
            </Box>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              contentContainerStyle={styles.list}
              onContentSizeChange={handleContentSizeChange}
            />
          )}

          {isLoading ? (
            <Box paddingHorizontal="md" paddingVertical="sm">
              <LoadingState />
            </Box>
          ) : null}

          {error ? (
            <Box margin="md" padding="sm" backgroundColor={colors.error + "20"} borderRadius={8}>
              <Typography variant="caption" color={colors.error}>
                {error}
              </Typography>
            </Box>
          ) : null}

          <Box padding="md" borderTopWidth={1} borderColor={colors.border} flexDirection="row" gap="sm">
            <Box flex={1}>
              <Input
                ref={inputRef}
                defaultValue=""
                onChangeText={setInputText}
                placeholder="Type a message..."
                onSubmitEditing={handleSubmit}
              />
            </Box>
            <Button
              title={isLoading ? "Stop" : "Send"}
              onPress={isLoading ? abort : handleSubmit}
              variant={isLoading ? "ghost" : "primary"}
              disabled={!isLoading && !inputText.trim()}
            />
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const GoalCoachScreen = React.memo(_GoalCoachScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.md },
  settingsIcon: { fontSize: 20, color: colors.textSecondary },
  startBtn: { marginTop: spacing.lg },
});
