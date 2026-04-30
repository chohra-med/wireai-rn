import React, { useCallback, useEffect, useRef } from "react";
import { Image, KeyboardAvoidingView, Platform, FlatList, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useWireAIThread,
  useWireAIInput,
  useWireAIAction,
  ComponentRenderer,
  LoadingState,
  colors,
  spacing,
  Message
} from "wireai-rn";
import { Box } from "../components/ui/Box";
import { Typography } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Brain } from "lucide-react-native";

export const CoachingScreen: React.FC<{ onSettings?: () => void }> = ({ onSettings }) => {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const { inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);
  const createActions = useWireAIAction(sendMessage);
  const listRef = useRef<FlatList>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);


  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === "user") {
      return (
        <Box alignSelf="flex-end" maxWidth="85%" marginVertical="xs" paddingHorizontal="md">
          <Box padding="sm" paddingHorizontal="md" backgroundColor={colors.primary} borderRadius={20}>
            <Typography color={colors.textInverse}>{item.content}</Typography>
          </Box>
        </Box>
      );
    }

    if (item.role === "assistant") {
      return (
        <Box paddingHorizontal="md" marginVertical="sm">
          {item.content && !item.response && (
            <Box padding="md" backgroundColor={colors.backgroundSecondary} borderRadius={20} alignSelf="flex-start" maxWidth="85%">
              <Typography>{item.content}</Typography>
            </Box>
          )}
          {item.response && (
            <ComponentRenderer
              messageId={item.id}
              response={item.response}
              callbackOverrides={createActions(item.id)}
            />
          )}
        </Box>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Box paddingHorizontal="md" paddingVertical="sm" borderBottomWidth={1} borderColor={colors.border} flexDirection="row" alignItems="center" gap="sm">
        <Image 
          source={require("../../assets/logo.webp")} 
          style={{ width: 32, height: 32, borderRadius: 8 }} 
          resizeMode="contain"
        />
        <Box flex={1}>
          <Typography variant="h4">Mental Coach</Typography>
        </Box>
        {onSettings && (
          <Pressable onPress={onSettings} hitSlop={12}>
            <Text style={{ fontSize: 20, color: colors.textSecondary }}>⚙</Text>
          </Pressable>
        )}
      </Box>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <Box flex={1} backgroundColor={colors.background}>
          {messages.length === 0 ? (
            <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
              <Brain size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
              <Typography variant="h3" textAlign="center">Welcome back</Typography>
              <Typography variant="body" color={colors.textSecondary} textAlign="center">
                I'm your AI guide. Ready for your daily check-in?
              </Typography>
              <Button 
                title="Start Check-in" 
                onPress={() => sendMessage("I want to start my daily check-in")} 
                style={{ marginTop: spacing.lg }} 
              />
            </Box>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.list}
            />
          )}

          {isLoading && (
            <Box paddingHorizontal="md" paddingVertical="sm">
              <LoadingState />
            </Box>
          )}

          {error && (
            <Box margin="md" padding="sm" backgroundColor={colors.error + "20"} borderRadius={8}>
              <Typography variant="caption" color={colors.error}>{error}</Typography>
            </Box>
          )}

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { paddingVertical: spacing.md },
});
