import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ComponentRenderer,
  LoadingState,
  WireAIProvider,
  colors,
  spacing,
  useWireAIInput,
  useWireAIThread,
  useLLMConfigStorage,
} from "wireai-rn";
import type { LocalLLMConfig } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components";
import { secureStorageBackend } from "../storage/secureStorageBackend";

// ─── Types ───────────────────────────────────────────────────────────────────

type Provider = "ollama" | "lmstudio" | "openai";

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

const PROVIDER_DEFAULTS: Record<Provider, { baseUrl: string; model: string }> = {
  ollama:   { baseUrl: "http://localhost:11434", model: "llama3" },
  lmstudio: { baseUrl: "http://localhost:1234",  model: "llama-3-8b-instruct" },
  openai:   { baseUrl: "https://api.openai.com", model: "gpt-4o-mini" },
};

// ─── Config Panel ─────────────────────────────────────────────────────────────

const ConfigPanel: React.FC<{
  initialConfig?: LocalLLMConfig;
  onStart: (config: LocalLLMConfig) => void;
}> = ({ initialConfig, onStart }) => {
  const [provider, setProvider] = useState<Provider>(
    (initialConfig?.provider as Provider) ?? "openai"
  );
  const [baseUrl, setBaseUrl] = useState(
    initialConfig?.baseUrl ?? PROVIDER_DEFAULTS.openai.baseUrl
  );
  const [model, setModel] = useState(
    initialConfig?.model ?? PROVIDER_DEFAULTS.openai.model
  );
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");

  const selectProvider = (p: Provider) => {
    setProvider(p);
    setBaseUrl(PROVIDER_DEFAULTS[p].baseUrl);
    setModel(PROVIDER_DEFAULTS[p].model);
  };

  const canStart = provider !== "openai" || apiKey.trim().length > 0;

  const handleStart = () => {
    if (!canStart) return;
    onStart({ provider, baseUrl, model, apiKey: apiKey.trim() || undefined });
  };

  return (
    <ScrollView contentContainerStyle={cfg.scroll} keyboardShouldPersistTaps="handled">
      <Text style={cfg.title}>WireAI SDK</Text>
      <Text style={cfg.subtitle}>Configure your LLM provider</Text>

      {/* Provider tabs */}
      <View style={cfg.tabs}>
        {(["openai", "ollama", "lmstudio"] as Provider[]).map((p) => (
          <Pressable
            key={p}
            style={[cfg.tab, provider === p && cfg.tabActive]}
            onPress={() => selectProvider(p)}
          >
            <Text style={[cfg.tabText, provider === p && cfg.tabTextActive]}>
              {p === "openai" ? "OpenAI" : p === "ollama" ? "Ollama" : "LM Studio"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* OpenAI */}
      {provider === "openai" && (
        <View style={cfg.section}>
          <Text style={cfg.label}>API Key</Text>
          <TextInput
            style={cfg.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Text style={cfg.label}>Model</Text>
          <View style={cfg.modelGrid}>
            {OPENAI_MODELS.map((m) => (
              <Pressable
                key={m}
                style={[cfg.modelBtn, model === m && cfg.modelBtnActive]}
                onPress={() => setModel(m)}
              >
                <Text style={[cfg.modelText, model === m && cfg.modelTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Local LLMs */}
      {(provider === "ollama" || provider === "lmstudio") && (
        <View style={cfg.section}>
          <Text style={cfg.label}>Server URL</Text>
          <TextInput
            style={cfg.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder={PROVIDER_DEFAULTS[provider].baseUrl}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={cfg.hint}>
            {provider === "ollama"
              ? "Physical device? Use your machine IP: http://192.168.x.x:11434"
              : "Start the local server in LM Studio (▶ button) first."}
          </Text>

          <Text style={cfg.label}>Model</Text>
          <TextInput
            style={cfg.input}
            value={model}
            onChangeText={setModel}
            placeholder={PROVIDER_DEFAULTS[provider].model}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      <Pressable
        style={[cfg.startBtn, !canStart && cfg.startBtnDisabled]}
        onPress={handleStart}
        disabled={!canStart}
      >
        <Text style={cfg.startText}>
          {provider === "openai" && !apiKey.trim() ? "Enter API key to continue" : "Start chatting →"}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

// ─── Chat UI ──────────────────────────────────────────────────────────────────

const ChatUI: React.FC<{ onSettings: () => void }> = ({ onSettings }: { onSettings: () => void }) => {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const { inputRef, inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleAction = useCallback(
    (action: string, payload?: unknown) => {
      let text: string;
      if (payload !== undefined && payload !== null) {
        const val = Array.isArray(payload)
          ? payload.join(", ")
          : typeof payload === "string"
          ? payload
          : JSON.stringify(payload);
        if (action === "select") text = `I selected: ${val}`;
        else if (action === "submit") text = `My answer is: ${val}`;
        else text = `${action}: ${val}`;
      } else {
        const labels: Record<string, string> = {
          confirm: "Yes, confirmed.",
          cancel: "No, cancel.",
          continue: "Continue.",
        };
        text = labels[action] ?? `${action}.`;
      }
      sendMessage(text, { interruptLoading: true });
    },
    [sendMessage],
  );

  return (
    <KeyboardAvoidingView
      style={chat.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={chat.header}>
        <Text style={chat.headerTitle}>WireAI</Text>
        <Pressable onPress={onSettings} hitSlop={12}>
          <Text style={chat.gear}>⚙</Text>
        </Pressable>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={chat.emptyState}>
          <Text style={chat.emptyTitle}>Ready</Text>
          <Text style={chat.emptyBody}>Send a message to start the conversation.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={chat.listContent}
          renderItem={({ item }) => {
            if (item.role === "user") {
              return (
                <View style={chat.userRow}>
                  <View style={chat.userBubble}>
                    <Text style={chat.userText}>{item.content}</Text>
                  </View>
                </View>
              );
            }
            if (item.role === "assistant" && item.response) {
              return (
                <View style={chat.assistantRow}>
                  <ComponentRenderer
                    messageId={item.id}
                    response={item.response}
                    callbackOverrides={{
                      onSubmit: (val: unknown) => handleAction("submit", val),
                      onSelect: (val: unknown) => handleAction("select", val),
                      onConfirm: () => handleAction("confirm"),
                      onCancel: () => handleAction("cancel"),
                      onContinue: () => handleAction("continue"),
                    }}
                  />
                </View>
              );
            }
            return null;
          }}
        />
      )}

      {isLoading && (
        <View style={chat.loadingWrap}>
          <LoadingState />
        </View>
      )}

      {error && (
        <View style={chat.errorBar}>
          <Text style={chat.errorText}>{error}</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={chat.inputBar}>
        <TextInput
          ref={inputRef}
          style={chat.input}
          defaultValue=""
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!isLoading}
        />
        <Pressable
          style={[chat.sendBtn, isLoading && chat.stopBtn]}
          onPress={isLoading ? abort : handleSubmit}
        >
          <Text style={chat.sendText}>{isLoading ? "■" : "→"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── ChatScreen ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LocalLLMConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
};

export const ChatScreen: React.FC = () => {
  const { config, isLoaded, saveConfig } = useLLMConfigStorage(
    secureStorageBackend,
    DEFAULT_CONFIG
  );
  const [showConfig, setShowConfig] = useState(false);

  if (!isLoaded) return null;

  const hasValidConfig =
    config.provider !== "openai" || !!config.apiKey?.trim();

  if (!hasValidConfig || showConfig) {
    return (
      <ConfigPanel
        initialConfig={config}
        onStart={(newConfig) => {
          saveConfig(newConfig);
          setShowConfig(false);
        }}
      />
    );
  }

  return (
    <WireAIProvider llm={config} components={defaultComponents}>
      <ChatUI onSettings={() => setShowConfig(true)} />
    </WireAIProvider>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cfg = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  tabs: {
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -4,
  },
  modelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  modelBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "15",
  },
  modelText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  modelTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

const chat = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  gear: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  listContent: { paddingVertical: spacing.md },
  userRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "80%",
  },
  userText: { color: "#fff", fontSize: 15 },
  assistantRow: {
    paddingHorizontal: spacing.md,
    marginVertical: 4,
  },
  loadingWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBar: {
    margin: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.error + "15",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: { fontSize: 13, color: colors.error },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stopBtn: { backgroundColor: colors.error },
  sendText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
