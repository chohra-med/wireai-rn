import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "wireai-rn";
import type { LocalLLMConfig } from "wireai-rn";
import { Box } from "./ui/Box";

type ConfigPanelProps = {
  config: LocalLLMConfig;
  sessionId: string;
  onSave: (config: LocalLLMConfig) => void;
};

const PRESETS: { label: string; url: string; hint: string }[] = [
  {
    label: "iOS sim",
    url: "http://localhost:3000/api/chat",
    hint: "iOS simulator can hit localhost directly.",
  },
  {
    label: "Android emu",
    url: "http://10.0.2.2:3000/api/chat",
    hint: "Android emulator routes 10.0.2.2 to your laptop's localhost.",
  },
  {
    label: "Device / LAN",
    url: "http://192.168.1.20:3000/api/chat",
    hint: "Replace with your laptop's LAN IP (`ipconfig getifaddr en0`).",
  },
];

const _ConfigPanel: React.FC<ConfigPanelProps> = ({ config, sessionId, onSave }) => {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePickPreset = useCallback((url: string) => {
    setBaseUrl(url);
    setValidationError(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!baseUrl.trim()) {
      setValidationError("Server URL is required");
      return;
    }
    if (!baseUrl.startsWith("http")) {
      setValidationError("Server URL must start with http:// or https://");
      return;
    }
    setValidationError(null);
    onSave({ ...config, baseUrl: baseUrl.trim() });
  }, [baseUrl, config, onSave]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Box marginVertical="sm">
          <Text style={s.title}>LangChain server</Text>
          <Text style={s.subtitle}>
            This example talks to a LangChain agent over HTTP via the wireai-rn WebhookAdapter.
          </Text>
        </Box>

        <View style={s.section}>
          <Text style={s.label}>Server URL</Text>
          <TextInput
            style={s.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="http://localhost:3000/api/chat"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
          <View style={s.presetRow}>
            {PRESETS.map((p) => (
              <Pressable key={p.label} style={s.presetBtn} onPress={() => handlePickPreset(p.url)}>
                <Text style={s.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.hint}>
            iOS sim: `localhost` works.{"\n"}
            Android emu: use `10.0.2.2`.{"\n"}
            Real device: use your laptop's LAN IP or an `ngrok` URL.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Session ID (read-only)</Text>
          <Text style={s.sessionId} selectable>
            {sessionId}
          </Text>
          <Text style={s.hint}>
            Sent to the server inside the system prompt as `[wire-session:&lt;id&gt;]` so the
            LangChain workflow can key per-conversation state. Regenerated each app launch.
          </Text>
        </View>

        {validationError ? <Text style={s.errorText}>{validationError}</Text> : null}

        <View style={s.actions}>
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
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  section: { gap: 8, marginBottom: 20 },
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
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: { fontSize: 12, color: colors.textSecondary },
  sessionId: {
    fontFamily: "Menlo",
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    padding: 10,
    borderRadius: 6,
  },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  errorText: { color: colors.error, fontSize: 12, marginBottom: 12, fontWeight: "600" as const, textAlign: "center" },
  actions: { gap: spacing.sm, marginTop: "auto" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700" as const },
});
