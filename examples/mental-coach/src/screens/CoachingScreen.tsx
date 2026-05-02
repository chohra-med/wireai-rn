import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ComponentRenderer,
  LoadingState,
  Message,
  colors,
  spacing,
  useWireAIAction,
  useWireAIInput,
  useWireAIThread,
} from "wireai-rn";
import type { CallbackOverrides } from "wireai-rn";
import { Box } from "../components/ui/Box";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Typography } from "../components/ui/Typography";
import { Brain } from "lucide-react-native";

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
  const callbackOverrides = useMemo(
    () => createActions(item.id),
    [createActions, item.id]
  );

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

type CoachingScreenProps = { onSettings?: () => void };

const _CoachingScreen: React.FC<CoachingScreenProps> = ({ onSettings }) => {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const { inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);
  const createActions = useWireAIAction(sendMessage);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const handleStartCheckin = useCallback(
    () => sendMessage("I want to start my daily check-in"),
    [sendMessage]
  );

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
        <Image source={require("../../assets/logo.webp")} style={styles.logo} resizeMode="contain" />
        <Box flex={1}>
          <Typography variant="h4">Mental Coach</Typography>
        </Box>
        {onSettings ? (
          <Pressable onPress={onSettings} hitSlop={12}>
            <Text style={styles.settingsIcon}>⚙</Text>
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
              <Brain size={48} color={colors.primary} style={styles.brainIcon} />
              <Typography variant="h3" textAlign="center">Welcome back</Typography>
              <Typography variant="body" color={colors.textSecondary} textAlign="center">
                I'm your AI guide. Ready for your daily check-in?
              </Typography>
              <Button title="Start Check-in" onPress={handleStartCheckin} style={styles.startBtn} />
            </Box>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              contentContainerStyle={styles.list}
            />
          )}

          {isLoading ? (
            <Box paddingHorizontal="md" paddingVertical="sm">
              <LoadingState />
            </Box>
          ) : null}

          {error ? (
            <Box margin="md" padding="sm" backgroundColor={colors.error + "20"} borderRadius={8}>
              <Typography variant="caption" color={colors.error}>{error}</Typography>
            </Box>
          ) : null}

          <Box padding="md" borderTopWidth={1} borderColor={colors.border} flexDirection="row" gap="sm">
            <Box flex={1}>
              <Input
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your feelings..."
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

export const CoachingScreen = React.memo(_CoachingScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.md },
  logo: { width: 32, height: 32, borderRadius: 8 },
  settingsIcon: { fontSize: 20, color: colors.textSecondary },
  brainIcon: { marginBottom: spacing.md },
  startBtn: { marginTop: spacing.lg },
});
