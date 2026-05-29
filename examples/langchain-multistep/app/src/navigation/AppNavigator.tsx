import React, { useCallback, useMemo, useState } from "react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { WireAIProvider, defaultComponents } from "wireai-rn";
import type { LocalLLMConfig } from "wireai-rn";
import { GoalCoachScreen } from "../screens/GoalCoachScreen";
import { ConfigPanel } from "../components/ConfigPanel";

const Drawer = createDrawerNavigator();

const DEFAULT_CONFIG: LocalLLMConfig = {
  provider: "webhook",
  baseUrl: "http://localhost:3000/api/chat",
  model: "langchain-agent",
};

const DRAWER_SCREEN_OPTIONS = {
  headerShown: false,
  drawerType: "front",
  drawerStyle: { width: "85%" as const },
  overlayColor: "rgba(0,0,0,0.5)",
} as const;

/**
 * The session id flows to the server through the system-prompt suffix as
 * `[wire-session:<id>]`. The wireai-rn `WebhookAdapter` doesn't forward
 * arbitrary headers in v0.1.x, so this is how we keep a stable per-launch
 * session key without touching the SDK.
 *
 * Generated once per app launch and kept in module scope so it survives
 * re-renders. Resets on a full app cold start.
 */
function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `expo-${Date.now().toString(36)}-${rand}`;
}

const SESSION_ID = generateSessionId();

const SYSTEM_PROMPT_SUFFIX = `[wire-session:${SESSION_ID}]

The actual agent prompt lives server-side in the LangChain workflow. This
suffix is intentionally minimal — its only job is to carry the session id
to the server so the multi-step workflow can key per-conversation state.`;

// ─── Drawer panel ────────────────────────────────────────────────────────────

type DrawerPanelProps = DrawerContentComponentProps & {
  config: LocalLLMConfig;
  onSave: (c: LocalLLMConfig) => void;
};

const _DrawerPanel: React.FC<DrawerPanelProps> = ({ navigation, config, onSave }) => {
  const handleSave = useCallback(
    (newConfig: LocalLLMConfig) => {
      onSave(newConfig);
      navigation.closeDrawer();
    },
    [onSave, navigation]
  );

  return <ConfigPanel config={config} sessionId={SESSION_ID} onSave={handleSave} />;
};
const DrawerPanel = React.memo(_DrawerPanel);

// ─── Navigator ───────────────────────────────────────────────────────────────

const _AppNavigator: React.FC = () => {
  const [llmConfig, setLlmConfig] = useState<LocalLLMConfig>(DEFAULT_CONFIG);

  const handleSaveConfig = useCallback((c: LocalLLMConfig) => {
    setLlmConfig(c);
  }, []);

  const renderDrawer = useCallback(
    (props: DrawerContentComponentProps) => (
      <DrawerPanel {...props} config={llmConfig} onSave={handleSaveConfig} />
    ),
    [llmConfig, handleSaveConfig]
  );

  const renderChatScreen = useCallback(
    ({ navigation }: { navigation: { openDrawer: () => void } }) => (
      <GoalCoachScreen onSettings={navigation.openDrawer} />
    ),
    []
  );

  const components = useMemo(() => defaultComponents, []);

  return (
    <NavigationContainer>
      <WireAIProvider
        key={`${llmConfig.provider}:${llmConfig.baseUrl}:${llmConfig.model}`}
        llm={llmConfig}
        components={components}
        systemPromptSuffix={SYSTEM_PROMPT_SUFFIX}
        streaming={false}
      >
        <Drawer.Navigator
          id="root"
          screenOptions={DRAWER_SCREEN_OPTIONS}
          drawerContent={renderDrawer}
        >
          <Drawer.Screen name="Chat">{renderChatScreen}</Drawer.Screen>
        </Drawer.Navigator>
      </WireAIProvider>
    </NavigationContainer>
  );
};

export const AppNavigator = React.memo(_AppNavigator);
