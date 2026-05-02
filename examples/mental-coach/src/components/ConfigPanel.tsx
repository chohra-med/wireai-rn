import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "wireai-rn";
import type { LocalLLMConfig } from "wireai-rn";
import { Box } from "./ui/Box";

type Provider = "ollama" | "lmstudio" | "openai";

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] as const;

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

const DEFAULTS: Record<Provider, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: "http://localhost:11434", model: "llama3" },
  lmstudio: { baseUrl: "http://localhost:1234", model: "llama-3-8b-instruct" },
  openai: { baseUrl: "https://api.openai.com", model: "gpt-4o-mini" },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

type ProviderTabProps = { provider: Provider; isActive: boolean; onSelect: (p: Provider) => void };

const _ProviderTab: React.FC<ProviderTabProps> = ({ provider, isActive, onSelect }) => {
  const handlePress = useCallback(() => onSelect(provider), [provider, onSelect]);
  return (
    <Pressable style={[s.tab, isActive ? s.tabActive : null]} onPress={handlePress}>
      <Text style={[s.tabText, isActive ? s.tabTextActive : null]}>
        {PROVIDER_LABELS[provider]}
      </Text>
    </Pressable>
  );
};
const ProviderTab = React.memo(_ProviderTab);

type ModelBtnProps = { model: string; isActive: boolean; onSelect: (m: string) => void };

const _ModelBtn: React.FC<ModelBtnProps> = ({ model, isActive, onSelect }) => {
  const handlePress = useCallback(() => onSelect(model), [model, onSelect]);
  return (
    <Pressable style={[s.modelBtn, isActive ? s.modelBtnActive : null]} onPress={handlePress}>
      <Text style={[s.modelText, isActive ? s.modelTextActive : null]}>{model}</Text>
    </Pressable>
  );
};
const ModelBtn = React.memo(_ModelBtn);

// ─── ConfigPanel ─────────────────────────────────────────────────────────────

type ConfigPanelProps = {
  config: LocalLLMConfig;
  onSave: (config: LocalLLMConfig) => void;
  onClearHistory: () => void;
};

const _ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onClearHistory }) => {
  const [provider, setProvider] = useState<Provider>(config.provider as Provider);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePickProvider = useCallback((p: Provider) => {
    setProvider(p);
    setBaseUrl(DEFAULTS[p].baseUrl);
    setModel(DEFAULTS[p].model);
    setValidationError(null);
  }, []);

  const handleSelectModel = useCallback((m: string) => {
    setModel(m);
  }, []);

  const handleSave = useCallback(() => {
    if (provider === "openai" && !apiKey.trim()) {
      setValidationError("API Key is required for OpenAI");
      return;
    }
    if (!model.trim()) {
      setValidationError("Model name is required");
      return;
    }
    if (!baseUrl.trim()) {
      setValidationError("Server URL is required");
      return;
    }
    setValidationError(null);
    onSave({ provider, baseUrl, model, apiKey: apiKey.trim() || undefined });
  }, [provider, apiKey, model, baseUrl, onSave]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Box flexDirection="row" alignItems="center" gap="sm" marginVertical="sm">
          <Image source={require("../../assets/logo.webp")} style={s.logo} resizeMode="contain" />
          <Text style={s.title}>AI Settings</Text>
        </Box>
        <Text style={s.subtitle}>Configure your AI provider for this session.</Text>

        <View style={s.tabs}>
          {(["openai", "ollama", "lmstudio"] as Provider[]).map((p) => (
            <ProviderTab key={p} provider={p} isActive={provider === p} onSelect={handlePickProvider} />
          ))}
        </View>

        {provider === "openai" ? (
          <View style={s.section}>
            <Text style={s.label}>API Key</Text>
            <TextInput
              style={s.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              secureTextEntry
            />
            <Text style={s.label}>Model</Text>
            <View style={s.modelGrid}>
              {OPENAI_MODELS.map((m) => (
                <ModelBtn key={m} model={m} isActive={model === m} onSelect={handleSelectModel} />
              ))}
            </View>
          </View>
        ) : null}

        {provider === "ollama" || provider === "lmstudio" ? (
          <View style={s.section}>
            <Text style={s.label}>Server URL</Text>
            <TextInput
              style={s.input}
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder={DEFAULTS[provider].baseUrl}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={s.label}>Model</Text>
            <TextInput
              style={s.input}
              value={model}
              onChangeText={setModel}
              placeholder={DEFAULTS[provider].model}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {validationError ? <Text style={s.errorText}>{validationError}</Text> : null}

        <View style={s.actions}>
          <Pressable style={s.clearBtn} onPress={onClearHistory}>
            <Text style={s.clearText}>Clear Conversation</Text>
          </Pressable>
          <Pressable style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveText}>Apply Changes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const ConfigPanel = React.memo(_ConfigPanel);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, flexGrow: 1, backgroundColor: colors.background },
  logo: { width: 40, height: 40, borderRadius: 10 },
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    padding: 2,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: {
    backgroundColor: colors.background,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabText: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" as const },
  tabTextActive: { color: colors.text, fontWeight: "600" as const },
  section: { gap: 12, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600" as const, color: colors.text },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  modelBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  modelText: { fontSize: 12, color: colors.textSecondary },
  modelTextActive: { color: colors.primary, fontWeight: "600" as const },
  actions: { gap: spacing.sm, marginTop: "auto" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700" as const },
  clearBtn: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearText: { color: colors.textSecondary, fontWeight: "600" as const, fontSize: 13 },
  errorText: { color: colors.error, fontSize: 12, marginBottom: 12, fontWeight: "600" as const, textAlign: "center" },
});
