import React, { useState } from "react";
import { Box } from "./ui/Box";
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable, Image } from "react-native";
import { colors, spacing } from "wireai-rn";
import type { LocalLLMConfig } from "wireai-rn";

type Provider = "ollama" | "lmstudio" | "openai";

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

const DEFAULTS: Record<Provider, { baseUrl: string; model: string }> = {
  ollama:   { baseUrl: "http://localhost:11434", model: "llama3" },
  lmstudio: { baseUrl: "http://localhost:1234",  model: "llama-3-8b-instruct" },
  openai:   { baseUrl: "https://api.openai.com", model: "gpt-4o-mini" },
};

interface ConfigPanelProps {
  config: LocalLLMConfig;
  onSave: (config: LocalLLMConfig) => void;
  onClearHistory: () => void;
}

import { SafeAreaView } from "react-native-safe-area-context";

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onClearHistory }) => {
  const [provider, setProvider] = useState<Provider>(config.provider as Provider);
  const [baseUrl, setBaseUrl]   = useState(config.baseUrl);
  const [model, setModel]       = useState(config.model);
  const [apiKey, setApiKey]     = useState(config.apiKey || "");

  const [validationError, setValidationError] = useState<string | null>(null);

  const pick = (p: Provider) => {
    setProvider(p);
    setBaseUrl(DEFAULTS[p].baseUrl);
    setModel(DEFAULTS[p].model);
    setValidationError(null);
  };

  const handleSave = () => {
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
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Box flexDirection="row" alignItems="center" gap="sm" marginBottom="sm">
          <Image 
            source={require("../../assets/logo.webp")} 
            style={{ width: 40, height: 40, borderRadius: 10 }} 
            resizeMode="contain"
          />
          <Text style={s.title}>AI Settings</Text>
        </Box>
        <Text style={s.subtitle}>Configure your AI provider for this session.</Text>

        <View style={s.tabs}>
          {(["openai", "ollama", "lmstudio"] as Provider[]).map((p) => (
            <Pressable key={p} style={[s.tab, provider === p && s.tabActive]} onPress={() => pick(p)}>
              <Text style={[s.tabText, provider === p && s.tabTextActive]}>
                {p === "openai" ? "OpenAI" : p === "ollama" ? "Ollama" : "LM Studio"}
              </Text>
            </Pressable>
          ))}
        </View>

        {provider === "openai" && (
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
                <Pressable key={m} style={[s.modelBtn, model === m && s.modelBtnActive]} onPress={() => setModel(m)}>
                  <Text style={[s.modelText, model === m && s.modelTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {(provider === "ollama" || provider === "lmstudio") && (
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
        )}

        {validationError && (
          <Text style={s.errorText}>{validationError}</Text>
        )}

        <View style={{ gap: spacing.sm, marginTop: "auto" }}>
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

const s = StyleSheet.create({
  container: { padding: spacing.md, flexGrow: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  tabs: { flexDirection: "row", backgroundColor: colors.backgroundSecondary, borderRadius: 10, padding: 2, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: colors.background, elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4 },
  tabText: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
  tabTextActive: { color: colors.text, fontWeight: "600" },
  section: { gap: 12, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, padding: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  modelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  modelBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  modelText: { fontSize: 12, color: colors.textSecondary },
  modelTextActive: { color: colors.primary, fontWeight: "600" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700" },
  clearBtn: { backgroundColor: "transparent", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  clearText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  errorText: { color: colors.error, fontSize: 12, marginBottom: 12, fontWeight: "600", textAlign: "center" },
});
